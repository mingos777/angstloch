import { Tile } from '../src';
import type { Grid } from '../src';

const COLOURS = {
  [Tile.Wall]: '#26262c',
  [Tile.Floor]: '#d8d2c4',
  [Tile.Door]: '#c8783c',
};

/** Resizes the canvas to fit the grid and paints every tile. */
export function drawGrid(
  canvas: HTMLCanvasElement,
  context: CanvasRenderingContext2D,
  grid: Grid,
  tileSize: number,
): void {
  canvas.width = grid.width * tileSize;
  canvas.height = grid.height * tileSize;
  for (let y = 0; y < grid.height; ++y) {
    for (let x = 0; x < grid.width; ++x) {
      context.fillStyle = COLOURS[grid.get(x, y)];
      context.fillRect(x * tileSize, y * tileSize, tileSize, tileSize);
    }
  }
}
