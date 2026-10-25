import { assertFraction } from '../core/assert-fraction';
import { assertRange } from '../core/assert-range';
import { createRoomPlan } from '../rooms/create-room-plan';
import { MAZE_ROOM_SPACING } from './maze-room-spacing';
import type { MazeRoomOptions } from './maze-room-options';
import type { Point } from '../core/point';
import type { Random } from '../core/random';
import { randomInt } from '../core/random-int';
import type { Room } from '../rooms/room';
import type { RoomPlan } from '../rooms/room-plan';
import { scatterRooms } from '../rooms/scatter-rooms';

/**
 * Places the ordinary rooms of a maze on its lattice, never over the `start`
 * cell or where `isBlocked` says so. Throws a `RangeError` for options that are out of range. Returns fewer
 * rooms than asked for when no more fit.
 */
export function placeMazeRooms(
  random: Random,
  width: number,
  height: number,
  options: MazeRoomOptions,
  start: Point | undefined,
  isBlocked?: RoomPlan['isBlocked'],
): Room[] {
  const count = options.count ?? { min: 1, max: 1 };
  const roomWidth = options.width ?? { min: 3, max: 7 };
  const roomHeight = options.height ?? { min: 3, max: 7 };
  const sizeUniformity = options.sizeUniformity ?? 0;
  assertRange('rooms.count', count, 0);
  assertRange('rooms.width', roomWidth, 1);
  assertRange('rooms.height', roomHeight, 1);
  assertFraction('rooms.sizeUniformity', sizeUniformity);

  const wanted = randomInt(random, count.min, count.max);
  const plan = createRoomPlan({
    width,
    height,
    placement: 'lattice',
    roomWidth,
    roomHeight,
    sizeUniformity,
    spacingUniformity: 0,
    roomCount: { min: wanted, max: wanted },
    roomSpacing: MAZE_ROOM_SPACING,
    fill: 0,
    isBlocked: (room) =>
      (start !== undefined &&
        start.x >= room.x &&
        start.x < room.x + room.width &&
        start.y >= room.y &&
        start.y < room.y + room.height) ||
      isBlocked?.(room) === true,
  });
  return plan && wanted > 0 ? scatterRooms(random, plan) : [];
}
