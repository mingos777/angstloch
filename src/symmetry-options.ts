import type { CorridorSymmetry } from './corridor-symmetry';
import type { LayoutSymmetry } from './layout-symmetry';

/** Options that make a dungeon symmetric. The two kinds of symmetry are independent and can be combined. */
export interface SymmetryOptions {
  /** Mirrors or rotates rooms, corridors, exits and doors about the centre of the map: `horizontal` (left to right), `vertical` (top to bottom), `both` or `rotational` (by 180°). Defaults to `none`. */
  layoutSymmetry?: LayoutSymmetry;
  /** How often the layout is symmetric, from 0 (never) to 1 (always, which makes the dungeon perfectly symmetric). In between, some rooms and corridors have no twins. Defaults to 1. */
  layoutSymmetryChance?: number;
  /** Makes corridors follow the pattern of a maze: `whirlpool` twirls them around the centre and `snowflake` makes them radiate from it. Defaults to `none`. */
  corridorSymmetry?: CorridorSymmetry;
  /** How strongly corridors follow `corridorSymmetry`, from 0 (not at all) to 1 (every choice of direction does). Defaults to 1. */
  corridorSymmetryChance?: number;
}
