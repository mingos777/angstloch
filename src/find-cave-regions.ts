import { DIRECTIONS } from './directions';
import type { Grid } from './grid';
import type { Point } from './point';
import { Tile } from './tile';

/**
 * Finds the groups of floor tiles that touch along an edge (diagonals do not
 * join them). The groups are sorted from the largest to the smallest; equal
 * sizes keep the order of their first tile, row by row.
 */
export function findCaveRegions(grid: Grid): Point[][] {
  const seen = new Uint8Array(grid.width * grid.height);
  const regions: Point[][] = [];
  for (let y = 0; y < grid.height; ++y) {
    for (let x = 0; x < grid.width; ++x) {
      if (seen[y * grid.width + x] || grid.get(x, y) !== Tile.Floor) {
        continue;
      }
      const tiles: Point[] = [];
      const pending: Point[] = [{ x, y }];
      seen[y * grid.width + x] = 1;
      for (let next = pending.pop(); next; next = pending.pop()) {
        tiles.push(next);
        for (const step of DIRECTIONS) {
          const nx = next.x + step.x;
          const ny = next.y + step.y;
          if (grid.get(nx, ny) === Tile.Floor && !seen[ny * grid.width + nx]) {
            seen[ny * grid.width + nx] = 1;
            pending.push({ x: nx, y: ny });
          }
        }
      }
      regions.push(tiles);
    }
  }
  return regions.sort((a, b) => b.length - a.length);
}
