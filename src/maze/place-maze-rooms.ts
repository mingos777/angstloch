import type { Point } from '../core/point';
import type { Range } from '../core/range';
import { assertAreaSize } from '../pipeline/assert-area-size';
import { assertWallBase } from '../pipeline/assert-wall-base';
import { buildInArea } from '../pipeline/build-in-area';
import type { MapStep } from '../pipeline/map-step';
import { placeAreas } from '../pipeline/place-areas';
import { step } from '../pipeline/step';
import { createRoomShape } from '../rooms/create-room-shape';
import { listShapeDoors } from '../rooms/list-shape-doors';
import { reserveRoomShape } from '../rooms/reserve-room-shape';
import type { Room } from '../rooms/room';
import type { RoomShape } from '../rooms/room-shape';
import { TemplateCell } from '../rooms/templates/template-cell';
import type { TemplatePlacement } from '../rooms/templates/template-placement';
import { assertPlaceMazeRoomsOptions } from './assert-place-maze-rooms-options';
import type { PlaceMazeRoomsOptions } from './place-maze-rooms-options';
import { prepareMazeRooms } from './prepare-maze-rooms';

/** The extras that `placeMazeRooms` uses and adds. */
interface MazeRooms {
  rooms: Room[];
  roomShapes: RoomShape[];
}

/** The rooms go in one box. */
const ONE: Range = { min: 1, max: 1 };

/** Whether a placed template has a cell other than `Unused` on a tile. */
function covers(placement: TemplatePlacement, { x, y }: Point): boolean {
  const cell = placement.cells[y - placement.y]?.[x - placement.x];
  return cell !== undefined && cell !== TemplateCell.Unused;
}

/**
 * A step that places the rooms of a maze on its lattice and carves them, for a
 * maze to be carved round them later: the templates first, then the ordinary
 * rooms, at random spots and three wall tiles apart, so that one maze cell
 * fits between two rooms. An ordinary room that finds no room is left out; a
 * template that cannot be placed fails the attempt, which `pipeline` retries.
 *
 * The rooms are not opened. Each gets a shape in `roomShapes` (an ordinary
 * room's is a ring of `OptionalExit` round its floor, see `createRoomShape`),
 * and reserves its footprint from it (see `reserveRoomShape`): the whole ring
 * of an ordinary room is `Openable`, though only the tiles that face a maze
 * cell can become an exit. It uses `rooms` and `roomShapes` from the steps
 * before it, and adds them again with its own appended, the ids following on.
 * The rooms go in one box of `area`, on the lattice; the map has to start as
 * wall, which `pipeline` checks before the first attempt. Throws a
 * `RangeError` at once for a bad option or template.
 */
export function placeMazeRooms(
  options: PlaceMazeRoomsOptions = {},
): MapStep<Partial<MazeRooms>, MazeRooms> {
  const {
    roomCount = { min: 1, max: 1 },
    roomWidth = { min: 3, max: 7 },
    roomHeight = { min: 3, max: 7 },
    sizeUniformity = 0,
    templates = [],
    doorChance = 1,
    keepClear,
    area = {},
  } = options;
  assertPlaceMazeRoomsOptions(options);

  return step<Partial<MazeRooms>, MazeRooms>(
    'placeMazeRooms',
    {
      adds: ['rooms', 'roomShapes'],
      validate: (state) => {
        assertWallBase('placeMazeRooms', state);
        assertAreaSize(area, ONE, state.grid.width, state.grid.height);
      },
    },
    (state, { random }) => {
      const rooms = [...(state.rooms ?? [])];
      const roomShapes = [...(state.roomShapes ?? [])];
      for (const box of placeAreas(state, random, area, ONE, {
        lattice: true,
      })) {
        const clear = keepClear && {
          x: keepClear.x - box.x,
          y: keepClear.y - box.y,
        };
        const inBox =
          clear &&
          clear.x >= 0 &&
          clear.y >= 0 &&
          clear.x < box.width &&
          clear.y < box.height
            ? clear
            : undefined;
        const placed = buildInArea(state, box, (scratch) => {
          const prepared = prepareMazeRooms(
            random,
            scratch.grid,
            {
              templates,
              rooms: {
                count: roomCount,
                width: roomWidth,
                height: roomHeight,
                sizeUniformity,
              },
            },
            inBox,
            doorChance,
          );
          if (inBox && prepared.isBlocked(inBox.x, inBox.y)) {
            prepared.fail(
              prepared.placements.findIndex((placement) =>
                covers(placement, inBox),
              ),
              `it covers keepClear (${String(keepClear?.x)}, ${String(keepClear?.y)})`,
            );
          }
          const shapes: RoomShape[] = prepared.rooms.map((room, id) => {
            const placement = prepared.placements[id];
            return placement
              ? {
                  ...placement,
                  doors: listShapeDoors(placement, prepared.doors, box.width),
                }
              : { ...createRoomShape(room), doors: [] };
          });
          for (const shape of shapes) {
            reserveRoomShape(scratch, shape);
          }
          return { rooms: prepared.rooms, shapes };
        });
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
        for (const shape of placed.shapes) {
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
