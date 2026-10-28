import { DIRECTIONS } from '../core/directions';
import type { Grid } from '../core/grid';
import type { Point } from '../core/point';
import type { TunnelOptions } from './tunnel-options';

/**
 * Finds the shortest walk from one position to another that a tunnel may
 * take: through any tile but the blocked ones, and, with `borderWalls`, off
 * the outermost ring of the map. Returns its tiles from `from` to `to`, both
 * included, or undefined when there is none.
 */
export function findTunnelPath(
  grid: Grid,
  from: Point,
  to: Point,
  { borderWalls, blocked }: Pick<TunnelOptions, 'borderWalls' | 'blocked'>,
): Point[] | undefined {
  const { width, height } = grid;
  const margin = borderWalls ? 1 : 0;
  const came = new Int32Array(width * height).fill(-1);
  const start = from.y * width + from.x;
  const goal = to.y * width + to.x;
  came[start] = start;
  const queue = [start];
  for (let head = 0; head < queue.length; ++head) {
    const at = queue[head] as number;
    if (at === goal) {
      const path: Point[] = [];
      for (let i = at; ; i = came[i] as number) {
        path.push({ x: i % width, y: Math.floor(i / width) });
        if (i === start) {
          return path.reverse();
        }
      }
    }
    const x = at % width;
    const y = Math.floor(at / width);
    for (const step of DIRECTIONS) {
      const nx = x + step.x;
      const ny = y + step.y;
      const next = ny * width + nx;
      if (
        nx >= margin &&
        ny >= margin &&
        nx < width - margin &&
        ny < height - margin &&
        came[next] === -1 &&
        !blocked?.[next]
      ) {
        came[next] = at;
        queue.push(next);
      }
    }
  }
  return undefined;
}
