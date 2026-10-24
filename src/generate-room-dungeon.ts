import { assertDimensions } from './assert-dimensions';
import { assertFraction } from './assert-fraction';
import { assertWeight } from './assert-weight';
import { assertWholeNumber } from './assert-whole-number';
import { assertPartition } from './assert-partition';
import { assertRange } from './assert-range';
import { carveRoom } from './carve-room';
import { connectRooms } from './connect-rooms';
import type { DungeonResult } from './dungeon-result';
import { Grid } from './grid';
import { placeRooms } from './place-rooms';
import { resolveRandom } from './resolve-random';
import type { RoomDungeonOptions } from './room-dungeon-options';

/**
 * Generates a dungeon room-first: rooms are placed on the map without
 * overlapping, then joined by corridors, and exits get doors.
 */
export function generateRoomDungeon(
  options: RoomDungeonOptions,
): DungeonResult {
  const {
    width,
    height,
    placement = 'free',
    roomWidth = { min: 3, max: 7 },
    roomHeight = { min: 3, max: 7 },
    sizeUniformity = 0,
    roomCount = { min: 1, max: Number.MAX_SAFE_INTEGER },
    roomSpacing = 1,
    partition = 'scatter',
    spacingUniformity = 0,
    fill = 0.12,
    exitsPerRoom = { min: 1, max: 3 },
    loopChance = 0.1,
    deadEndChance = 0,
    doorChance = 1,
    straight = 0.5,
    horizontalBias = 0,
    verticalBias = 0,
  } = options;

  assertDimensions(width, height);
  assertRange('roomWidth', roomWidth, 1);
  assertRange('roomHeight', roomHeight, 1);
  assertRange('roomCount', roomCount, 0);
  assertRange('exitsPerRoom', exitsPerRoom, 1);
  assertPartition(partition);
  assertFraction('sizeUniformity', sizeUniformity);
  assertFraction('spacingUniformity', spacingUniformity);
  assertFraction('loopChance', loopChance);
  assertFraction('deadEndChance', deadEndChance);
  assertWholeNumber('roomSpacing', roomSpacing, 1);
  assertFraction('fill', fill);
  assertFraction('doorChance', doorChance);
  assertFraction('straight', straight);
  assertWeight('horizontalBias', horizontalBias);
  assertWeight('verticalBias', verticalBias);
  const random = resolveRandom(options.random);

  let rooms = placeRooms(random, {
    width,
    height,
    placement,
    partition,
    roomWidth,
    roomHeight,
    sizeUniformity,
    spacingUniformity,
    roomCount,
    roomSpacing,
    fill,
  });

  // A room that cannot be joined to the rest is dropped, which can only make
  // routing easier for the others, so this ends.
  for (;;) {
    const grid = new Grid(width, height);
    for (const room of rooms) {
      carveRoom(grid, room);
    }
    const { exits, stranded } = connectRooms(grid, rooms, random, {
      lattice: placement === 'lattice',
      doorChance,
      straight,
      horizontalBias,
      verticalBias,
      exitsPerRoom,
      loopChance,
      deadEndChance,
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
