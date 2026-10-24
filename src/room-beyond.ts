import { DIRECTIONS } from './directions';
import type { Point } from './point';
import type { Random } from './random';
import { randomInt } from './random-int';
import type { Room } from './room';

/**
 * Makes a room of a given size whose wall has a gap at `wall`, which is the
 * wall tile that a corridor heading in `direction` ends at. Where along the
 * wall the gap falls is random; on the lattice it falls on an odd coordinate.
 * The room is not checked against the map.
 */
export function roomBeyond(
  random: Random,
  wall: Point,
  direction: number,
  width: number,
  height: number,
  step: number,
): Room {
  const heading = DIRECTIONS[direction] as Point;
  const vertical = heading.y !== 0;
  const length = vertical ? width : height;
  const offset = step * randomInt(random, 0, Math.floor((length - 1) / step));
  let x = wall.x - (vertical ? offset : 0);
  let y = wall.y - (vertical ? 0 : offset);
  if (heading.x > 0) {
    x = wall.x + 1;
  } else if (heading.x < 0) {
    x = wall.x - width;
  } else if (heading.y > 0) {
    y = wall.y + 1;
  } else {
    y = wall.y - height;
  }
  return { id: 0, x, y, width, height, exits: [], exitCount: 0, doorCount: 0 };
}
