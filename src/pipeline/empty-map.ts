import { assertDimensions } from '../core/assert-dimensions';
import { assertTile } from '../core/assert-tile';
import { Grid } from '../core/grid';
import type { EmptyMapOptions } from './empty-map-options';
import type { MapBase } from './map-base';

/**
 * The start of a pipeline: a map of one tile. It returns a factory, so that
 * every attempt starts from a fresh state. The options are checked at once, and
 * a bad one throws a `RangeError`.
 */
export function emptyMap(options: EmptyMapOptions): MapBase {
  const { width, height, tile } = options;
  assertDimensions(width, height);
  assertTile('tile', tile);
  return () => ({
    grid: new Grid(width, height, tile),
    base: tile,
    prunable: new Uint8Array(width * height),
    reserved: new Uint8Array(width * height),
  });
}
