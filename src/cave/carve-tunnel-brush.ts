import type { Grid } from '../core/grid';
import { Tile } from '../core/tile';

/**
 * Turns a square of `width` by `width` tiles around the position into floor.
 * With `borderWalls`, the outermost ring of the map is left alone.
 */
export function carveTunnelBrush(
  grid: Grid,
  x: number,
  y: number,
  width: number,
  borderWalls: boolean,
): void {
  const margin = borderWalls ? 1 : 0;
  const start = -Math.floor((width - 1) / 2);
  for (let dy = start; dy < start + width; ++dy) {
    for (let dx = start; dx < start + width; ++dx) {
      const tx = x + dx;
      const ty = y + dy;
      if (
        tx >= margin &&
        ty >= margin &&
        tx < grid.width - margin &&
        ty < grid.height - margin
      ) {
        grid.set(tx, ty, Tile.Floor);
      }
    }
  }
}
