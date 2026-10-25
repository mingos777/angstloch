import { assertFraction } from '../core/assert-fraction';
import { assertPartition } from './assert-partition';
import { carveRoom } from '../rooms/carve-room';
import { carveTemplate } from '../rooms/templates/carve-template';
import { createSteering } from './create-steering';
import { connectRooms } from './connect-rooms';
import { createTemplateBlocker } from '../rooms/templates/create-template-blocker';
import type { DungeonResult } from './dungeon-result';
import { effectiveSpacing } from '../rooms/effective-spacing';
import { Grid } from '../core/grid';
import { prepareTemplates } from '../rooms/templates/prepare-templates';
import { placeRooms } from './place-rooms';
import { resolveDungeonOptions } from '../rooms/resolve-dungeon-options';
import { resolveSymmetryOptions } from '../rooms/resolve-symmetry-options';
import { createRoomPlan } from '../rooms/create-room-plan';
import type { Room } from '../rooms/room';
import type { RoomDungeonOptions } from '../rooms/room-dungeon-options';

/** Times a dungeon is built around its templates before a template that is cut off is reported. */
const MAX_ATTEMPTS = 10;

/**
 * Generates a dungeon room-first: templated rooms are placed first, then the
 * other rooms around them without overlapping, then everything is joined by
 * corridors, and exits get doors.
 */
export function generateRoomDungeon(
  options: RoomDungeonOptions,
): DungeonResult {
  const resolved = resolveDungeonOptions(options);
  const { width, height, random, placement } = resolved;
  const partition = options.partition ?? 'scatter';
  const spacingUniformity = options.spacingUniformity ?? 0;
  assertPartition(partition);
  assertFraction('spacingUniformity', spacingUniformity);
  const symmetry = resolveSymmetryOptions(options);
  const lattice = placement === 'lattice';
  const spacing = effectiveSpacing(resolved.roomSpacing, lattice);

  // templated rooms come first, so they have the lowest ids
  const templated = prepareTemplates(
    random,
    options,
    resolved,
    symmetry.layoutSymmetry,
  );
  const { placements, doors } = templated;
  const templatedCount = placements.length;

  // templated rooms count towards the room count and the fill
  const roomPlanOptions = {
    ...resolved,
    roomCount: {
      min: Math.max(0, resolved.roomCount.min - templatedCount),
      max: Math.max(0, resolved.roomCount.max - templatedCount),
    },
    fill: Math.max(0, resolved.fill - templated.floor / (width * height)),
    partition,
    spacingUniformity,
    layout: symmetry.layoutSymmetry,
    symmetryChance: symmetry.layoutSymmetryChance,
    isBlocked: createTemplateBlocker(placements, width, height, spacing),
  };
  const { transforms } = createRoomPlan(roomPlanOptions) ?? { transforms: [] };
  const steering = createSteering({ ...resolved, ...symmetry, lattice });
  const steered =
    symmetry.corridorSymmetry !== 'none' && symmetry.corridorSymmetryChance > 0;

  /** Builds the dungeon around the templated rooms with new ordinary rooms, or says which templated room is cut off and why. */
  const attempt = (): DungeonResult | { room: number; problem: string } => {
    let rooms: Room[] = [
      ...templated.rooms(),
      ...(templatedCount > 0 && roomPlanOptions.roomCount.max === 0
        ? []
        : placeRooms(random, roomPlanOptions).map((room) => ({
            ...room,
            id: room.id + templatedCount,
          }))),
    ];

    // A room that cannot be joined to the rest is dropped, which can only make
    // routing easier for the others, so this ends. A templated room is never
    // dropped: that is a failure.
    for (;;) {
      const grid = new Grid(width, height);
      for (const room of rooms) {
        const shape = placements[room.id];
        if (shape) {
          carveTemplate(grid, shape, doors);
        } else {
          carveRoom(grid, room);
        }
      }
      const { exits, stranded, unconnected } = connectRooms(
        grid,
        rooms,
        random,
        {
          ...resolved,
          lattice,
          layout: { transforms, chance: symmetry.layoutSymmetryChance },
          steering: steered ? steering : undefined,
          templates: placements,
          doors,
        },
      );
      const [lost] = unconnected;
      if (lost) {
        return {
          room: lost.room,
          problem: `the exit at (${String(lost.position.x)}, ${String(lost.position.y)}) cannot be joined to the rest of the dungeon`,
        };
      }
      const cutOff = stranded.find((id) => placements[id]);
      if (cutOff !== undefined) {
        return {
          room: cutOff,
          problem: 'cannot be joined to the rest of the dungeon',
        };
      }
      if (stranded.length === 0) {
        const covered = rooms.reduce(
          (sum, r) => sum + (placements[r.id] ? 0 : r.width * r.height),
          templated.floor,
        );
        return { grid, rooms, exits, fill: covered / (width * height) };
      }
      // the twins of a room that is dropped go with it
      const dropped = new Set(stranded);
      for (const id of stranded) {
        for (const transform of transforms) {
          const image = transform.room(rooms[id] as Room);
          const twin = rooms.find(
            (room) =>
              room.x === image.x &&
              room.y === image.y &&
              room.width === image.width &&
              room.height === image.height,
          );
          if (twin) {
            dropped.add(twin.id);
          }
        }
      }
      rooms = rooms
        .filter((room) => !dropped.has(room.id))
        .map((room, id) => ({
          ...room,
          id,
          exits: [],
          exitCount: 0,
          doorCount: 0,
        }));
    }
  };

  // Corridors can box in a fixed exit of a template, which new rooms and
  // corridors usually fix, so the dungeon is tried again before giving up.
  for (let tries = 1; ; ++tries) {
    const built = attempt();
    if ('grid' in built) {
      return built;
    }
    if (tries === MAX_ATTEMPTS) {
      templated.fail(built.room, built.problem);
    }
  }
}
