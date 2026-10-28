import type { MapState } from './map-state';
import { Reserve } from './reserve';

/**
 * Whether a step may build on a tile: it holds the base tile or is prunable
 * (untouched ground or ground cover), and nothing has reserved it. A tile
 * outside the grid is not free.
 */
export function isFree(
  state: Pick<MapState, 'grid' | 'base' | 'prunable' | 'reserved'>,
  x: number,
  y: number,
): boolean {
  const { grid } = state;
  if (!grid.inBounds(x, y)) {
    return false;
  }
  const at = y * grid.width + x;
  return (
    state.reserved[at] === Reserve.None &&
    (grid.get(x, y) === state.base || state.prunable[at] === 1)
  );
}
