import type { Grid } from '../core/grid';
import type { Point } from '../core/point';
import { Tile } from '../core/tile';
import { MARGIN } from './dig-vein';

/**
 * Finds the tiles of a hall that lie on its boundary, among the floor tiles
 * it is made of: those with a tile of wall next to them, along an edge, that
 * is not on the outer rings of the map that stay wall. A vein can leave the
 * hall from such a tile. Tiles that earlier veins have already walled in, so
 * that they have no wall left next to them, are not on the boundary.
 */
export function findHallBoundary(grid: Grid, floor: readonly Point[]): Point[] {
  const open = (x: number, y: number) =>
    x >= MARGIN &&
    y >= MARGIN &&
    x < grid.width - MARGIN &&
    y < grid.height - MARGIN &&
    grid.get(x, y) === Tile.Wall;
  return floor.filter(
    ({ x, y }) =>
      open(x + 1, y) || open(x - 1, y) || open(x, y + 1) || open(x, y - 1),
  );
}
