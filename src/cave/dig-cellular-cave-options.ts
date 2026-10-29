import type { CaveAreaOptions } from './cave-area-options';
import type { CaveNeighborhood } from './cave-neighborhood';

/** Options of `digCellularCave`. */
export interface DigCellularCaveOptions extends CaveAreaOptions {
  /** Chance that a tile starts as a wall, from 0 to 1. Defaults to 0.45. */
  fillChance?: number;
  /** Number of smoothing passes. Defaults to 4. */
  iterations?: number;
  /** A floor tile turns into a wall when at least this many of its neighbors are walls. Defaults to 5 for the `moore` neighborhood and 3 for `von-neumann`. */
  birthLimit?: number;
  /** A wall tile stays a wall when at least this many of its neighbors are walls, and turns into floor otherwise. Defaults to 4 for the `moore` neighborhood and 2 for `von-neumann`. */
  survivalLimit?: number;
  /** Which tiles count as neighbors. Tiles outside the area always count as walls. Defaults to `moore`. */
  neighborhood?: CaveNeighborhood;
}
