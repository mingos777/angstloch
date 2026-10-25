import { DIRECTIONS } from '../core/directions';
import type { Grid } from '../core/grid';
import type { Point } from '../core/point';
import { Tile } from '../core/tile';

/**
 * Finds the shortest way from a group of floor tiles to any other floor tile,
 * through rock or anything else, and returns its two ends: a tile of the
 * group and the tile it reaches. Returns undefined when there is no other
 * floor.
 */
export function findCaveLink(
  grid: Grid,
  group: readonly Point[],
): { from: Point; to: Point } | undefined {
  const { width, height } = grid;
  const origin = new Int32Array(width * height).fill(-1);
  const inGroup = new Uint8Array(width * height);
  const queue: number[] = [];
  for (const { x, y } of group) {
    inGroup[y * width + x] = 1;
    origin[y * width + x] = y * width + x;
    queue.push(y * width + x);
  }
  for (let head = 0; head < queue.length; ++head) {
    const index = queue[head] as number;
    const x = index % width;
    const y = Math.floor(index / width);
    if (!inGroup[index] && grid.get(x, y) === Tile.Floor) {
      const start = origin[index] as number;
      return {
        from: { x: start % width, y: Math.floor(start / width) },
        to: { x, y },
      };
    }
    for (const step of DIRECTIONS) {
      const nx = x + step.x;
      const ny = y + step.y;
      if (grid.inBounds(nx, ny) && origin[ny * width + nx] === -1) {
        origin[ny * width + nx] = origin[index] as number;
        queue.push(ny * width + nx);
      }
    }
  }
  return undefined;
}
