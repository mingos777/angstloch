import type { Point } from '../core/point';

/**
 * The maze cell to start carving from: the one in the middle of the map or,
 * when that is blocked, the free cell nearest to it.
 */
export function findMazeStart(
  width: number,
  height: number,
  isBlocked: (x: number, y: number) => boolean,
): Point {
  const cellsX = Math.floor((width - 1) / 2);
  const cellsY = Math.floor((height - 1) / 2);
  const middle = {
    x: 1 + 2 * Math.floor(cellsX / 2),
    y: 1 + 2 * Math.floor(cellsY / 2),
  };
  let nearest = middle;
  let distance = isBlocked(middle.x, middle.y) ? Infinity : 0;
  for (let y = 1; y <= height - 2 && distance > 0; y += 2) {
    for (let x = 1; x <= width - 2; x += 2) {
      const d = (x - middle.x) ** 2 + (y - middle.y) ** 2;
      if (d < distance && !isBlocked(x, y)) {
        nearest = { x, y };
        distance = d;
      }
    }
  }
  return nearest;
}
