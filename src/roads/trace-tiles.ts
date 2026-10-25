import type { Point } from '../core/point';

/**
 * Lists the tiles on the straight line from one tile to another, both
 * included. Every tile is next to the one before it along an edge, never only
 * at a corner, so a line of tiles is a path that can be walked without
 * stepping diagonally.
 */
export function traceTiles(from: Point, to: Point): Point[] {
  const distanceX = Math.abs(to.x - from.x);
  const distanceY = Math.abs(to.y - from.y);
  const stepX = Math.sign(to.x - from.x);
  const stepY = Math.sign(to.y - from.y);
  const tiles: Point[] = [{ x: from.x, y: from.y }];
  let x = from.x;
  let y = from.y;
  for (let doneX = 0, doneY = 0; doneX < distanceX || doneY < distanceY;) {
    // take the step that keeps the path closest to the straight line
    if ((0.5 + doneX) / distanceX < (0.5 + doneY) / distanceY) {
      x += stepX;
      ++doneX;
    } else {
      y += stepY;
      ++doneY;
    }
    tiles.push({ x, y });
  }
  return tiles;
}
