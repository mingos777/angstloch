import type { CaveLink } from './cave-link';
import { DIRECTIONS } from '../core/directions';
import type { Grid } from '../core/grid';
import { isCaveShortcut } from './is-cave-shortcut';
import type { Point } from '../core/point';

/** How many of the nearest other caverns each cavern is paired with. */
const NEIGHBORS = 3;

/**
 * Lists the tunnels that would make loops in a map whose caverns are joined
 * already. `caverns` are the caverns as they were before they were joined.
 * Every cavern is paired with its three nearest neighbors, across rock or
 * anything else but the tiles that `blocked` marks, and a pair is a candidate when walking between its closest
 * tiles over the floor takes much longer than the gap itself. A pair that a
 * tunnel joins directly is not a candidate, because that walk is short.
 * Candidates come in the order of the caverns, nearest neighbor first, and
 * each pair appears once.
 */
export function planCaveLoops(
  grid: Grid,
  caverns: readonly (readonly Point[])[],
  blocked?: Uint8Array,
): CaveLink[] {
  const { width, height } = grid;
  const owner = new Int32Array(width * height).fill(-1);
  caverns.forEach((tiles, index) => {
    for (const { x, y } of tiles) {
      owner[y * width + x] = index;
    }
  });

  const candidates: CaveLink[] = [];
  const paired = new Set<number>();
  caverns.forEach((tiles, index) => {
    const gap = new Int32Array(width * height).fill(-1);
    const origin = new Int32Array(width * height);
    const queue: number[] = [];
    for (const { x, y } of tiles) {
      gap[y * width + x] = 0;
      origin[y * width + x] = y * width + x;
      queue.push(y * width + x);
    }
    const found = new Set<number>();
    for (let head = 0; head < queue.length && found.size < NEIGHBORS; ++head) {
      const at = queue[head] as number;
      const x = at % width;
      const y = Math.floor(at / width);
      const other = owner[at] as number;
      if (other !== -1 && other !== index && !found.has(other)) {
        found.add(other);
        const key =
          Math.min(index, other) * caverns.length + Math.max(index, other);
        const start = origin[at] as number;
        const link = {
          from: { x: start % width, y: Math.floor(start / width) },
          to: { x, y },
        };
        if (!paired.has(key) && isCaveShortcut(grid, link)) {
          candidates.push(link);
        }
        paired.add(key);
      }
      for (const step of DIRECTIONS) {
        const nx = x + step.x;
        const ny = y + step.y;
        if (
          grid.inBounds(nx, ny) &&
          gap[ny * width + nx] === -1 &&
          !blocked?.[ny * width + nx]
        ) {
          gap[ny * width + nx] = (gap[at] as number) + 1;
          origin[ny * width + nx] = origin[at] as number;
          queue.push(ny * width + nx);
        }
      }
    }
  });
  return candidates;
}
