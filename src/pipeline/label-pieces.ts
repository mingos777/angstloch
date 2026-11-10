import { DIRECTIONS } from '../core/directions';
import type { Grid } from '../core/grid';
import { Tile } from '../core/tile';

/** 1 + the index of the piece of open ground, joined along edges, that holds each tile, 0 for wall. */
export function labelPieces(grid: Grid): Int32Array {
  const label = new Int32Array(grid.width * grid.height);
  let pieces = 0;
  for (let start = 0; start < label.length; ++start) {
    const sx = start % grid.width;
    if (
      label[start] !== 0 ||
      grid.get(sx, (start - sx) / grid.width) === Tile.Wall
    ) {
      continue;
    }
    label[start] = ++pieces;
    for (const queue = [start]; queue.length > 0;) {
      const at = queue.pop() as number;
      const x = at % grid.width;
      const y = (at - x) / grid.width;
      for (const step of DIRECTIONS) {
        const [nx, ny] = [x + step.x, y + step.y];
        const next = ny * grid.width + nx;
        if (
          grid.inBounds(nx, ny) &&
          label[next] === 0 &&
          grid.get(nx, ny) !== Tile.Wall
        ) {
          label[next] = pieces;
          queue.push(next);
        }
      }
    }
  }
  return label;
}
