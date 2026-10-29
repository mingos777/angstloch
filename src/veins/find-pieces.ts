import { DIRECTIONS } from '../core/directions';
import type { Grid } from '../core/grid';
import type { Point } from '../core/point';
import { Tile } from '../core/tile';

/**
 * Finds the pieces of open ground on the map: every set of tiles that are not
 * wall, joined along edges. A room, a hall, a cavern and a tunnel are pieces,
 * and so is everything they are joined to. The pieces come in the order of
 * their first tile, row by row.
 */
export function findPieces(grid: Grid): Point[][] {
  const { width, height } = grid;
  const seen = new Uint8Array(width * height);
  const pieces: Point[][] = [];
  for (let start = 0; start < width * height; ++start) {
    const sx = start % width;
    if (seen[start] === 1 || grid.get(sx, (start - sx) / width) === Tile.Wall) {
      continue;
    }
    seen[start] = 1;
    const tiles: Point[] = [];
    for (const queue = [start]; queue.length > 0;) {
      const at = queue.pop() as number;
      const x = at % width;
      const y = (at - x) / width;
      tiles.push({ x, y });
      for (const step of DIRECTIONS) {
        const [nx, ny] = [x + step.x, y + step.y];
        const next = ny * width + nx;
        if (
          grid.inBounds(nx, ny) &&
          seen[next] === 0 &&
          grid.get(nx, ny) !== Tile.Wall
        ) {
          seen[next] = 1;
          queue.push(next);
        }
      }
    }
    pieces.push(tiles);
  }
  return pieces;
}
