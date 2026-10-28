import type { LayoutSymmetry } from '../core/layout-symmetry';
import type { Range } from '../core/range';
import type { Tile } from '../core/tile';

/** Options of `openExits`. */
export interface OpenExitsOptions {
  /** How many exits to carve, a range of whole numbers of at least 0. Defaults to 0 to 0, which adds none. Twins of an exit made by `symmetry` count towards it. The step stops early, with fewer, when it fails to find a place ten times in a row. */
  count?: Range;
  /** Puts doors on odd border coordinates only, which is where a maze has its cells. Defaults to false. */
  lattice?: boolean;
  /** Mirrors or rotates exits about the center of the map, so that an exit gets twins: `horizontal` (left to right), `vertical` (top to bottom), `both` or `rotational` (by 180°). Defaults to `none`. */
  symmetry?: LayoutSymmetry;
  /** The chance that an exit has twins, from 0 to 1. Defaults to 1. */
  symmetryChance?: number;
  /** The tile of a door on the border. Defaults to `Tile.Door`. */
  tile?: Tile;
}
