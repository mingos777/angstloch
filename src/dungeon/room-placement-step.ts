import type { Random } from '../core/random';
import { assertAreaSize } from '../pipeline/assert-area-size';
import { assertWallBase } from '../pipeline/assert-wall-base';
import { buildInArea } from '../pipeline/build-in-area';
import type { MapState } from '../pipeline/map-state';
import type { MapStep } from '../pipeline/map-step';
import { placeAreas } from '../pipeline/place-areas';
import { step } from '../pipeline/step';
import { carveRoom } from '../rooms/carve-room';
import { createRoomPlan } from '../rooms/create-room-plan';
import { createRoomShape } from '../rooms/create-room-shape';
import { createTileBlocker } from '../rooms/create-tile-blocker';
import { effectiveSpacing } from '../rooms/effective-spacing';
import { findTakenTiles } from '../rooms/find-taken-tiles';
import { listShapeDoors } from '../rooms/list-shape-doors';
import { reserveRoomShape } from '../rooms/reserve-room-shape';
import type { Room } from '../rooms/room';
import type { RoomPlacer } from '../rooms/room-plan';
import type { RoomShape } from '../rooms/room-shape';
import { carveTemplate } from '../rooms/templates/carve-template';
import { createTemplateBlocker } from '../rooms/templates/create-template-blocker';
import { prepareTemplates } from '../rooms/templates/prepare-templates';
import { TemplateCell } from '../rooms/templates/template-cell';
import type { TemplatePlacement } from '../rooms/templates/template-placement';
import { validateTemplateAreas } from '../rooms/templates/validate-template-areas';
import { assertRoomPlacementOptions } from './assert-room-placement-options';
import type { PlacedRooms } from './placed-rooms';
import type { RoomPlacementOptions } from './room-placement-options';

type Settings = Required<
  Omit<RoomPlacementOptions, 'area' | 'count' | 'templates'>
> &
  Pick<RoomPlacementOptions, 'templates'> & { spacingUniformity: number };

/** The taken tiles as one placement the size of the map, which templates keep clear of like another room. */
function takenPlacement(
  taken: Uint8Array,
  width: number,
  height: number,
): TemplatePlacement {
  return {
    x: 0,
    y: 0,
    width,
    height,
    cells: Array.from({ length: height }, (_, y) =>
      Array.from({ length: width }, (__, x) =>
        taken[y * width + x] ? TemplateCell.Floor : TemplateCell.Unused,
      ),
    ),
    exits: [],
    rotation: 0,
    mirrored: false,
  };
}

/**
 * Places, carves and reserves the rooms of one area, on its scratch state:
 * the templates first, then the ordinary rooms by `placer`, both clear of the
 * taken tiles. `earlier` holds the shapes of the rooms there are, in the
 * coordinates of the scratch. The placer is given the `earlier` shapes to grow
 * from when `grows` and the area is the whole map, else the first template;
 * with `grows` and nothing earlier to grow from, the first template goes in
 * the middle. Ids start at 0, coordinates at the scratch's.
 */
function placeInArea(
  scratch: MapState,
  random: Random,
  settings: Settings,
  placer: RoomPlacer,
  earlier: readonly TemplatePlacement[],
  grows: boolean,
  wholeMap: boolean,
): PlacedRooms {
  const { width, height } = scratch.grid;
  const lattice = settings.placement === 'lattice';
  const spacing = effectiveSpacing(settings.roomSpacing, lattice);
  const taken = findTakenTiles(scratch, earlier);

  // templated rooms come first, so they have the lowest ids
  const templated = prepareTemplates(
    random,
    settings,
    { ...settings, width, height },
    settings.symmetry,
    grows && !(wholeMap && earlier.length > 0),
    taken ? [takenPlacement(taken, width, height)] : [],
  );
  const { placements, doors } = templated;
  const templatedCount = placements.length;
  const nearTemplate = createTemplateBlocker(
    placements,
    width,
    height,
    spacing,
  );
  const nearTaken = taken && createTileBlocker(taken, width, height, spacing);

  // templated rooms count towards the room count and the fill
  const { roomCount } = settings;
  const plan = createRoomPlan({
    ...settings,
    width,
    height,
    roomCount: {
      min: Math.max(0, roomCount.min - templatedCount),
      max: Math.max(0, roomCount.max - templatedCount),
    },
    fill: Math.max(0, settings.fill - templated.floor / (width * height)),
    layout: settings.symmetry,
    isBlocked: (room) =>
      (nearTemplate?.(room) ?? false) || (nearTaken?.(room) ?? false),
  });
  const seeds =
    wholeMap && earlier.length > 0 ? earlier : placements.slice(0, 1);
  const ordinary =
    plan && plan.roomCount.max > 0 ? placer(random, plan, seeds) : [];
  const rooms: Room[] = [
    ...templated.rooms(),
    ...ordinary.map((room) => ({ ...room, id: room.id + templatedCount })),
  ];

  const roomShapes = rooms.map((room): RoomShape => {
    const placement = placements[room.id];
    if (placement) {
      carveTemplate(scratch.grid, placement, doors);
      return {
        ...placement,
        doors: listShapeDoors(placement, doors, width),
      };
    }
    carveRoom(scratch.grid, room);
    return { ...createRoomShape(room), doors: [] };
  });
  for (const shape of roomShapes) {
    reserveRoomShape(scratch, shape);
  }
  return { rooms, roomShapes };
}

/**
 * Makes a step that places dungeon rooms, the shared core of `placeScatteredRooms`,
 * `placePartitionedRooms` and `placeClusteredRooms`, which differ only in the `placer` that
 * picks the spots of the ordinary rooms, and in whether it `grows` them from
 * the rooms there are. In each area it places the templates, then the
 * ordinary rooms, carves them and reserves their shapes; it appends them to
 * the `rooms` and `roomShapes` there are, with ids that follow on. Checks the
 * options at once.
 */
export function roomPlacementStep(
  name: string,
  options: RoomPlacementOptions & { spacingUniformity?: number },
  placer: RoomPlacer,
  grows = false,
): MapStep<Partial<PlacedRooms>, PlacedRooms> {
  assertRoomPlacementOptions(options);
  const { templates = [], area = {}, count = { min: 1, max: 1 } } = options;
  const settings: Settings = {
    placement: options.placement ?? 'free',
    roomWidth: options.roomWidth ?? { min: 3, max: 7 },
    roomHeight: options.roomHeight ?? { min: 3, max: 7 },
    sizeUniformity: options.sizeUniformity ?? 0,
    roomCount: options.roomCount ?? { min: 1, max: Number.MAX_SAFE_INTEGER },
    roomSpacing: options.roomSpacing ?? 1,
    fill: options.fill ?? 0.12,
    spacingUniformity: options.spacingUniformity ?? 0,
    templates,
    templateSymmetry: options.templateSymmetry ?? false,
    doorChance: options.doorChance ?? 1,
    symmetry: options.symmetry ?? 'none',
    symmetryChance: options.symmetryChance ?? 1,
  };
  const lattice = settings.placement === 'lattice';

  return step<Partial<PlacedRooms>, PlacedRooms>(
    name,
    {
      adds: ['rooms', 'roomShapes'],
      validate: (state) => {
        const { width, height } = state.grid;
        assertWallBase(name, state);
        assertAreaSize(area, count, width, height);
        templates.forEach((template, index) => {
          validateTemplateAreas(template, index, width, height, lattice);
        });
      },
    },
    (state, { random }) => {
      const rooms = [...(state.rooms ?? [])];
      const roomShapes = [...(state.roomShapes ?? [])];
      for (const box of placeAreas(state, random, area, count, { lattice })) {
        const earlier = roomShapes.map((shape) => ({
          ...shape,
          x: shape.x - box.x,
          y: shape.y - box.y,
        }));
        const wholeMap =
          box.width === state.grid.width && box.height === state.grid.height;
        const placed = buildInArea(state, box, (scratch) =>
          placeInArea(
            scratch,
            random,
            settings,
            placer,
            earlier,
            grows,
            wholeMap,
          ),
        );
        // the new rooms follow on from the ones there are, in the coordinates of the map
        const firstId = rooms.length;
        for (const room of placed.rooms) {
          rooms.push({
            ...room,
            id: room.id + firstId,
            x: room.x + box.x,
            y: room.y + box.y,
          });
        }
        for (const shape of placed.roomShapes) {
          roomShapes.push({
            ...shape,
            x: shape.x + box.x,
            y: shape.y + box.y,
            doors: shape.doors.map((door) => ({
              ...door,
              x: door.x + box.x,
              y: door.y + box.y,
            })),
          });
        }
      }
      return { rooms, roomShapes };
    },
  );
}
