import type { LayoutSymmetry } from '../core/layout-symmetry';
import type { Range } from '../core/range';
import type { Tile } from '../core/tile';

/** Options of `openExits`. */
export interface OpenExitsOptions {
  /** Where the exits go: `'border'`, anywhere on the border, each with a tunnel to the nearest floor, or `'outfalls'`, at the outfalls of the sewers in the `roomGroups` extra that are still `Openable`, picked at random. Defaults to `'border'`. */
  at?: 'border' | 'outfalls';
  /** How many exits to open, a range of whole numbers of at least 0. Defaults to 0 to 0, which adds none. Twins of an exit made by `symmetry` count towards it. The step stops early, with fewer, when it fails to find a place ten times in a row, or, at the outfalls, when it runs out of them. */
  count?: Range;
  /** Puts doors on odd border coordinates only, which is where a maze has its cells. Only at the border. Defaults to false. */
  lattice?: boolean;
  /** Mirrors or rotates exits about the center of the map, so that an exit gets twins: `horizontal` (left to right), `vertical` (top to bottom), `both` or `rotational` (by 180°). Only at the border. Defaults to `none`. */
  symmetry?: LayoutSymmetry;
  /** The chance that an exit has twins, from 0 to 1. Only at the border. Defaults to 1. */
  symmetryChance?: number;
  /** The tile of a door on the border. Defaults to `Tile.Door`. */
  tile?: Tile;
}
