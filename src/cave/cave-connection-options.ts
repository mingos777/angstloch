import type { LayoutSymmetry } from '../core/layout-symmetry';

/**
 * What to do with caverns that are not joined to each other: `none` leaves
 * them, `largest` fills in all but the largest one and `tunnel` digs tunnels
 * to join them.
 */
export type CaveConnect = 'none' | 'largest' | 'tunnel';

/** The shape of a tunnel: `winding` meanders, `direct` is a straight line with at most one bend. */
export type CaveTunnelStyle = 'winding' | 'direct';

/** The options that every cave generator shares for what happens once the caverns exist: joining them, mirroring them and adding exits. */
export interface CaveConnectionOptions {
  /** Keeps the outermost ring of tiles solid wall. Defaults to true. */
  borderWalls?: boolean;
  /** Fills in every cavern smaller than this many tiles, which removes small pockets. Defaults to 0, which keeps all. */
  minRegionSize?: number;
  /** What to do with caverns that are not joined. Defaults to `tunnel`. */
  connect?: CaveConnect;
  /** The shape of the tunnels made by `connect: 'tunnel'`. Defaults to `winding`. */
  tunnelStyle?: CaveTunnelStyle;
  /** The width of the tunnels in tiles, a whole number of at least 1. Defaults to 1. */
  tunnelWidth?: number;
  /** How much `winding` tunnels meander, from 0 (they head straight for their goal, with small jitters) to 1 (they wander a lot). Defaults to 0.5. */
  tunnelWindiness?: number;
  /** The chance, from 0 to 1, of an extra tunnel at every place where one would make a loop, a shortcut between neighboring caverns that are joined only by a long way round. Applies to `connect: 'tunnel'` only. Defaults to 0, which makes no loops. */
  tunnelLoops?: number;
  /** Mirrors or rotates the starting noise about the center of the map, which makes the cave symmetric: `horizontal` (left to right), `vertical` (top to bottom), `both` or `rotational` (by 180°). Defaults to `none`. */
  layoutSymmetry?: LayoutSymmetry;
  /** How often a tile of the starting noise copies its twin, from 0 (never, so the noise is plain random) to 1 (always, which makes the cave perfectly symmetric). Defaults to 1. */
  layoutSymmetryChance?: number;
  /** How often a tunnel, including the tunnels of `tunnelLoops`, has twins that follow `layoutSymmetry`, from 0 (never) to 1 (always, which keeps a perfectly symmetric cave perfectly symmetric). It is rolled for every tunnel, and applies to `connect: 'tunnel'` with a `layoutSymmetry` only. Defaults to 1. */
  tunnelSymmetryChance?: number;
  /** Minimum number of exits to add on the map border. Defaults to 0. */
  minExits?: number;
  /** Maximum number of exits to add. Defaults to `minExits`. */
  maxExits?: number;
}
