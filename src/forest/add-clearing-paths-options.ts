import type { Tile } from '../core/tile';
import type { Verge } from '../roads/verge';

/**
 * Options of `addClearingPaths`: the tiles of a path and of a bridge, and the
 * verge that is kept clear of trees beside the paths (`clearance`, `falloff`,
 * `distance`). The width and windiness of a path are those the clearing asked
 * for.
 */
export interface AddClearingPathsOptions extends Verge {
  /** The tile for a path. Use the `roadTile` of `addRoads`, so that paths and roads look alike. Defaults to `Tile.Road`. */
  roadTile?: Tile;
  /** The tile for a bridge, where a path spans water. Use the `bridgeTile` of `addRoads`. Defaults to `Tile.Bridge`. */
  bridgeTile?: Tile;
}
