import type { Tile } from '../core/tile';

/** Options of `layFootbridges`. */
export interface LayFootbridgesOptions {
  /** How many bridges the map has at least, counting the bridges of roads, a whole number of at least 0. Footbridges are added across the streams until it is reached, as far apart from the bridges there as there is room, and fewer are laid when there is no room. A footbridge that is needed to join land that the water cuts apart is laid whatever this says. Defaults to 0. */
  minimum?: number;
  /** The tile for a footbridge. Use the `bridgeTile` of `layRoads`, so that a bridge of a road counts as one and looks alike. Defaults to `Tile.Bridge`. */
  bridgeTile?: Tile;
}
