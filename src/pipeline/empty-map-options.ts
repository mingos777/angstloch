import type { Tile } from '../core/tile';

/** Options of `emptyMap`. */
export interface EmptyMapOptions {
  /** Map width in tiles. */
  width: number;
  /** Map height in tiles. */
  height: number;
  /** The tile the whole map starts as: grass for a forest, a wall for a dungeon or a mine. */
  tile: Tile;
}
