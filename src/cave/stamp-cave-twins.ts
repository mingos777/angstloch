import type { Grid } from '../core/grid';
import type { Transform } from '../rooms/templates/create-transforms';
import { Tile } from '../core/tile';

/**
 * Turns the images of every tile that has become floor since `before` into
 * floor, in place, so that whatever was dug has twins. A twin on a tile that
 * `blocked` marks is left out.
 */
export function stampCaveTwins(
  grid: Grid,
  before: Grid,
  images: readonly Transform[],
  blocked?: Uint8Array,
): void {
  for (let y = 0; y < grid.height; ++y) {
    for (let x = 0; x < grid.width; ++x) {
      if (grid.get(x, y) === Tile.Floor && before.get(x, y) !== Tile.Floor) {
        for (const { point } of images) {
          const image = point({ x, y });
          if (!blocked?.[image.y * grid.width + image.x]) {
            grid.set(image.x, image.y, Tile.Floor);
          }
        }
      }
    }
  }
}
