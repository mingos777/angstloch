import { assertFraction } from './assert-fraction';
import { assertPartition } from './assert-partition';
import { carveRoom } from './carve-room';
import { connectRooms } from './connect-rooms';
import type { DungeonResult } from './dungeon-result';
import { Grid } from './grid';
import { placeRooms } from './place-rooms';
import { resolveDungeonOptions } from './resolve-dungeon-options';
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

  let rooms = placeRooms(random, {
    ...resolved,
    partition,
    spacingUniformity,
  });

  // A room that cannot be joined to the rest is dropped, which can only make
  // routing easier for the others, so this ends.
  for (;;) {
    const grid = new Grid(width, height);
    for (const room of rooms) {
      carveRoom(grid, room);
    }
    const { exits, stranded } = connectRooms(grid, rooms, random, {
      ...resolved,
      lattice: placement === 'lattice',
    });
    if (stranded.length === 0) {
      const covered = rooms.reduce((sum, r) => sum + r.width * r.height, 0);
      return { grid, rooms, exits, fill: covered / (width * height) };
    }
    rooms = rooms
      .filter((room) => !stranded.includes(room.id))
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
