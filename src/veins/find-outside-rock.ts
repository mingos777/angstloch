import type { Grid } from '../core/grid';
import { DIRECTIONS } from '../core/directions';
import { Tile } from '../core/tile';

/**
 * Marks the wall that can be reached from the border of the map along wall
 * tiles, joined along edges: the rock outside every hall. Wall that floor shuts
 * in, such as the pillars of a hall, is not marked. Returns a byte for each
 * tile, row by row, 1 for the wall that is reached.
 */
export function findOutsideRock(grid: Grid): Uint8Array {
  const { width, height } = grid;
  const outside = new Uint8Array(width * height);
  const queue: number[] = [];
  const visit = (x: number, y: number): void => {
    const at = y * width + x;
    if (outside[at] === 0 && grid.get(x, y) === Tile.Wall) {
      outside[at] = 1;
      queue.push(at);
    }
  };
  for (let x = 0; x < width; ++x) {
    visit(x, 0);
    visit(x, height - 1);
  }
  for (let y = 0; y < height; ++y) {
    visit(0, y);
    visit(width - 1, y);
  }
  for (let head = 0; head < queue.length; ++head) {
    const at = queue[head] as number;
    const x = at % width;
    const y = (at - x) / width;
    for (const step of DIRECTIONS) {
      if (grid.inBounds(x + step.x, y + step.y)) {
        visit(x + step.x, y + step.y);
      }
    }
  }
  return outside;
}
