import type { MapState } from './map-state';
import { Reserve } from './reserve';

/**
 * Records that an exit was opened on a tile: the tile and every `Openable` tile
 * around it, diagonals included, become `Solid`, so that no two exits end up
 * side by side. Tiles that are not `Openable` are left as they are, except the
 * tile itself, which is `Solid` whatever it was. Throws a `RangeError` outside
 * the grid.
 */
export function openReserved(
  state: Pick<MapState, 'grid' | 'reserved'>,
  x: number,
  y: number,
): void {
  const { grid, reserved } = state;
  if (!grid.inBounds(x, y)) {
    throw new RangeError(
      `Tile (${String(x)}, ${String(y)}) is outside the grid`,
    );
  }
  reserved[y * grid.width + x] = Reserve.Solid;
  for (let dy = -1; dy <= 1; ++dy) {
    for (let dx = -1; dx <= 1; ++dx) {
      if (grid.inBounds(x + dx, y + dy)) {
        const at = (y + dy) * grid.width + x + dx;
        if (reserved[at] === Reserve.Openable) {
          reserved[at] = Reserve.Solid;
        }
      }
    }
  }
}
