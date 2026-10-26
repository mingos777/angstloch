import type { BaseOptions } from '../core/base-options';
import type { CaveConnectionOptions } from './cave-connection-options';

/**
 * Which tiles count as neighbors: `moore` is the 8 tiles around a tile,
 * `von-neumann` the 4 tiles that share an edge with it.
 */
export type CaveNeighborhood = 'moore' | 'von-neumann';

export interface CaveOptions extends BaseOptions, CaveConnectionOptions {
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
}
