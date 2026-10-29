import { DIRECTIONS } from '../core/directions';
import type { Grid } from '../core/grid';
import { Tile } from '../core/tile';
import { MARGIN } from '../veins/dig-vein';

/** How far each tile is from the mine, and the way to it. */
export interface Reach {
  /** The steps along edges to the nearest floor, row by row, or -1 where there is no way. */
  distance: Int32Array;
  /** The tile that the nearest way leads to next, or -1 at floor and where there is no way. */
  next: Int32Array;
}

/**
 * Measures how far every tile is from the nearest floor of the mine, going
 * around the `solid` tiles and the outer rings of the map, which it never
 * crosses. Floor that is solid, such
 * as the floor of a room, does not count as the mine.
 */
export function measureReach(grid: Grid, solid: Uint8Array): Reach {
  const { width, height } = grid;
  const distance = new Int32Array(width * height).fill(-1);
  const next = new Int32Array(width * height).fill(-1);
  const queue: number[] = [];
  for (let at = 0; at < width * height; ++at) {
    if (
      solid[at] !== 1 &&
      grid.get(at % width, Math.floor(at / width)) === Tile.Floor
    ) {
      distance[at] = 0;
      queue.push(at);
    }
  }
  for (let head = 0; head < queue.length; ++head) {
    const at = queue[head] ?? 0;
    const x = at % width;
    const y = Math.floor(at / width);
    for (const step of DIRECTIONS) {
      const nx = x + step.x;
      const ny = y + step.y;
      const to = ny * width + nx;
      if (
        nx >= MARGIN &&
        ny >= MARGIN &&
        nx < width - MARGIN &&
        ny < height - MARGIN &&
        distance[to] === -1 &&
        solid[to] !== 1
      ) {
        distance[to] = (distance[at] ?? 0) + 1;
        next[to] = at;
        queue.push(to);
      }
    }
  }
  return { distance, next };
}
