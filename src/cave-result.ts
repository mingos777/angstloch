import type { CaveRegion } from './cave-region';
import type { Grid } from './grid';
import type { Point } from './point';

export interface CaveResult {
  /** The generated map. */
  grid: Grid;
  /** The caverns of the map, largest first, so `regions[0]` is the largest. Empty when there is no floor. */
  regions: CaveRegion[];
  /** Door tiles on the map border, one per exit. */
  exits: Point[];
}
