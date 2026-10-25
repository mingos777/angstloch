import type { MazeOpening } from './maze-opening';
import type { Point } from './point';
import type { Room } from './room';

/**
 * Lists the ways to open the walls of a rectangular room onto a maze cell
 * that is inside the map and not blocked. Only odd offsets line up with a
 * maze cell, and a room starts on an odd tile.
 */
export function findRoomOpenings(
  room: Room,
  width: number,
  height: number,
  isBlocked: (x: number, y: number) => boolean,
): MazeOpening[] {
  const { x, y } = room;
  const openings: MazeOpening[] = [];
  const add = (inside: Point, step: Point): void => {
    const wall = { x: inside.x + step.x, y: inside.y + step.y };
    const outside = { x: wall.x + step.x, y: wall.y + step.y };
    if (
      outside.x >= 1 &&
      outside.y >= 1 &&
      outside.x <= width - 2 &&
      outside.y <= height - 2 &&
      !isBlocked(outside.x, outside.y)
    ) {
      openings.push({ room, wall, inside, outside });
    }
  };
  for (let i = 0; i < room.width; i += 2) {
    add({ x: x + i, y }, { x: 0, y: -1 });
    add({ x: x + i, y: y + room.height - 1 }, { x: 0, y: 1 });
  }
  for (let i = 0; i < room.height; i += 2) {
    add({ x, y: y + i }, { x: -1, y: 0 });
    add({ x: x + room.width - 1, y: y + i }, { x: 1, y: 0 });
  }
  return openings;
}
