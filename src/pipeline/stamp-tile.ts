import type { MapState } from './map-state';
import type { Tile } from '../core/tile';

/**
 * Sets a tile and clears its prunable byte, so that no later step takes it for
 * ground cover. Every step that lays something down goes through it. Throws a
 * `RangeError` outside the grid.
 */
export function stampTile(
  state: Pick<MapState, 'grid' | 'prunable'>,
  x: number,
  y: number,
  tile: Tile,
): void {
  state.grid.set(x, y, tile);
  state.prunable[y * state.grid.width + x] = 0;
}
