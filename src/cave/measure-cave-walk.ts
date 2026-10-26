import { DIRECTIONS } from '../core/directions';
import type { Grid } from '../core/grid';
import type { Point } from '../core/point';
import { Tile } from '../core/tile';

/**
 * Counts the steps of the shortest walk over floor tiles from one position
 * to another. Returns Infinity when the floor does not join them.
 */
export function measureCaveWalk(grid: Grid, from: Point, to: Point): number {
  const { width, height } = grid;
  const steps = new Int32Array(width * height).fill(-1);
  const queue = [from];
  steps[from.y * width + from.x] = 0;
  for (let head = 0; head < queue.length; ++head) {
    const { x, y } = queue[head] as Point;
    const taken = steps[y * width + x] as number;
    if (x === to.x && y === to.y) {
      return taken;
    }
    for (const step of DIRECTIONS) {
      const nx = x + step.x;
      const ny = y + step.y;
      if (grid.get(nx, ny) === Tile.Floor && steps[ny * width + nx] === -1) {
        steps[ny * width + nx] = taken + 1;
        queue.push({ x: nx, y: ny });
      }
    }
  }
  return Infinity;
}
