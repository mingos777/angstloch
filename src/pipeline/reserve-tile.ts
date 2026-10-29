import type { MapState } from './map-state';
import type { Reserve } from './reserve';

/**
 * Marks a tile as reserved, so that no later step digs through it. Throws a
 * `RangeError` outside the grid. It leaves the tile itself alone.
 */
export function reserveTile(
  state: Pick<MapState, 'grid' | 'reserved'>,
  x: number,
  y: number,
  kind: Reserve,
): void {
  if (!state.grid.inBounds(x, y)) {
    throw new RangeError(
      `Tile (${String(x)}, ${String(y)}) is outside the grid`,
    );
  }
  state.reserved[y * state.grid.width + x] = kind;
}
