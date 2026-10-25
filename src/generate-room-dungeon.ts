import { assertFraction } from './assert-fraction';
import { assertPartition } from './assert-partition';
import { carveRoom } from './carve-room';
import { createSteering } from './create-steering';
import { connectRooms } from './connect-rooms';
import type { DungeonResult } from './dungeon-result';
import { Grid } from './grid';
import { placeRooms } from './place-rooms';
import { resolveDungeonOptions } from './resolve-dungeon-options';
import { resolveSymmetryOptions } from './resolve-symmetry-options';
import { createRoomPlan } from './create-room-plan';
import type { Room } from './room';
import type { RoomDungeonOptions } from './room-dungeon-options';

/**
 * Generates a dungeon room-first: rooms are placed on the map without
 * overlapping, then joined by corridors, and exits get doors.
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

  const roomPlanOptions = {
    ...resolved,
    partition,
    spacingUniformity,
    layout: symmetry.layoutSymmetry,
    symmetryChance: symmetry.layoutSymmetryChance,
  };
  const { transforms } = createRoomPlan(roomPlanOptions) ?? { transforms: [] };
  let rooms = placeRooms(random, roomPlanOptions);
  const steering = createSteering({ ...resolved, ...symmetry, lattice });
  const steered =
    symmetry.corridorSymmetry !== 'none' && symmetry.corridorSymmetryChance > 0;

  // A room that cannot be joined to the rest is dropped, which can only make
  // routing easier for the others, so this ends.
  for (;;) {
    const grid = new Grid(width, height);
    for (const room of rooms) {
      carveRoom(grid, room);
    }
    const { exits, stranded } = connectRooms(grid, rooms, random, {
      ...resolved,
      lattice,
      layout: { transforms, chance: symmetry.layoutSymmetryChance },
      steering: steered ? steering : undefined,
    });
    if (stranded.length === 0) {
      const covered = rooms.reduce((sum, r) => sum + r.width * r.height, 0);
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
      .map(({ x, y, width: w, height: h }, id) => ({
        id,
        x,
        y,
        width: w,
        height: h,
        exits: [],
        exitCount: 0,
        doorCount: 0,
      }));
  }
}
