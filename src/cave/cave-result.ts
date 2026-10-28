import type { CaveRegion } from './cave-region';
import type { Grid } from '../core/grid';
import type { PipelineFailure } from '../pipeline/pipeline-failure';
import type { Point } from '../core/point';

export interface CaveResult {
  /** The generated map. */
  grid: Grid;
  /** The caverns of the finished map, largest first, so `regions[0]` is the largest. With the tunnels there is one, unless a cave without floor has none. */
  regions: CaveRegion[];
  /** Door tiles on the map border, one per exit. Empty without the `exits` option. */
  exits: Point[];
  /** How many times the cave was built, 1 or more: a map is built again when a step throws, up to 3 in all. */
  attempts: number;
  /** One entry per failed attempt, also when a later attempt succeeded. */
  failures: PipelineFailure[];
}
