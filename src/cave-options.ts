import type { BaseOptions } from './base-options';

/**
 * Which tiles count as neighbors: `moore` is the 8 tiles around a tile,
 * `von-neumann` the 4 tiles that share an edge with it.
 */
export type CaveNeighborhood = 'moore' | 'von-neumann';

/**
 * What to do with caverns that are not joined to each other: `none` leaves
 * them, `largest` fills in all but the largest one and `tunnel` digs tunnels
 * to join them.
 */
export type CaveConnect = 'none' | 'largest' | 'tunnel';

/** The shape of a tunnel: `winding` meanders, `direct` is a straight line with at most one bend. */
export type CaveTunnelStyle = 'winding' | 'direct';

export interface CaveOptions extends BaseOptions {
  /** Chance that a tile starts as a wall, from 0 to 1. Defaults to 0.45. */
  fillChance?: number;
  /** Number of smoothing passes. Defaults to 4. */
  iterations?: number;
  /** A floor tile turns into a wall when at least this many of its neighbors are walls. Defaults to 5 for the `moore` neighborhood and 3 for `von-neumann`. */
  birthLimit?: number;
  /** A wall tile stays a wall when at least this many of its neighbors are walls, and turns into floor otherwise. Defaults to 4 for the `moore` neighborhood and 2 for `von-neumann`. */
  survivalLimit?: number;
  /** Which tiles count as neighbors. Tiles outside the map always count as walls. Defaults to `moore`. */
  neighborhood?: CaveNeighborhood;
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
  /** Minimum number of exits to add on the map border. Defaults to 0. */
  minExits?: number;
  /** Maximum number of exits to add. Defaults to `minExits`. */
  maxExits?: number;
}
