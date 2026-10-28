import { Tile } from '../core/tile';
import type { MapState } from './map-state';

/** Throws a `RangeError` unless the map starts as wall, which a step that digs its floor out of rock needs. */
export function assertWallBase(name: string, state: MapState): void {
  if (state.base !== Tile.Wall) {
    throw new RangeError(
      `${name} digs its floor out of rock, but the map starts as tile ${String(state.base)}, not wall. Start the map with emptyMap({ width, height, tile: Tile.Wall }).`,
    );
  }
}
