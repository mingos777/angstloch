import type { Tile } from '../core/tile';
import type { Verge } from '../roads/verge';
import type { StreamOptions } from './stream-options';

/**
 * Options of `addStreams`: the water part of `StreamOptions` (the bridges are
 * the business of the steps that lay them), the tiles of the water, and the
 * verge that is kept clear of trees beside it, whose fields are listed here
 * as well (`clearance`, `falloff`, `distance`).
 */
export interface AddStreamsOptions
  extends Omit<StreamOptions, 'bridges' | 'bridgeAngle'>, Verge {
  /** The tile for the shallow water of a stream. Defaults to `Tile.ShallowWater`. */
  shallowTile?: Tile;
  /** The tile for the deep water of a stream. Defaults to `Tile.DeepWater`. */
  deepTile?: Tile;
}
