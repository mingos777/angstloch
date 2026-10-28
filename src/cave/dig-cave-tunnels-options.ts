import type { LayoutSymmetry } from '../core/layout-symmetry';
import type { CaveTunnelStyle } from './cave-tunnel-style';

/** Options of `digCaveTunnels`. */
export interface DigCaveTunnelsOptions {
  /** The shape of the tunnels: `winding` meanders, `direct` is a straight line with at most one bend. Defaults to `winding`. */
  style?: CaveTunnelStyle;
  /** The width of the tunnels in tiles, a whole number of at least 1. Defaults to 1. */
  width?: number;
  /** How much `winding` tunnels meander, from 0 (they head straight for their goal, with small jitters) to 1 (they wander a lot). Defaults to 0.5. */
  windiness?: number;
  /** The chance, from 0 to 1, of an extra tunnel at every place where one would make a loop, a shortcut between neighboring pieces of floor that are joined only by a long way round. Defaults to 0, which makes no loops. */
  loops?: number;
  /** Keeps tunnels off the outermost ring of tiles of the map. Defaults to true. */
  borderWalls?: boolean;
  /** The symmetry of the map, which tunnels follow by getting twins mirrored or rotated about the center of the map: `horizontal`, `vertical`, `both` or `rotational`. Defaults to `none`. */
  symmetry?: LayoutSymmetry;
  /** How often a tunnel, a loop included, gets its twins, from 0 (never) to 1 (always, which keeps a perfectly symmetric map perfectly symmetric). Applies with a `symmetry` only. Defaults to 1. */
  symmetryChance?: number;
}
