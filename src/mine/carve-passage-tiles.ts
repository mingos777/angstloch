import type { Grid } from '../core/grid';
import type { Point } from '../core/point';
import { Tile } from '../core/tile';
import { brushOffsets } from '../roads/brush-offsets';

/**
 * Turns the walls around the given tiles into floor, as far as a passage of
 * the given width reaches. Anything that is not wall is left as it is, and so
 * are the `margin` outermost rings of the grid and the tiles that `protect`
 * marks with a 1, row by row. Calls `onCarve` for every tile that became
 * floor, and returns how many there were.
 */
export function carvePassageTiles(
  grid: Grid,
  tiles: readonly Point[],
  width: number,
  margin = 0,
  onCarve?: (x: number, y: number) => void,
  protect?: Uint8Array,
): number {
  const offsets = brushOffsets(width);
  let carved = 0;
  for (const tile of tiles) {
    for (const offset of offsets) {
      const x = tile.x + offset.x;
      const y = tile.y + offset.y;
      if (
        x >= margin &&
        y >= margin &&
        x < grid.width - margin &&
        y < grid.height - margin &&
        grid.get(x, y) === Tile.Wall &&
        protect?.[y * grid.width + x] !== 1
      ) {
        grid.set(x, y, Tile.Floor);
        ++carved;
        onCarve?.(x, y);
      }
    }
  }
  return carved;
}
