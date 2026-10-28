import type { Grid } from '../core/grid';
import type { Point } from '../core/point';
import type { PipelineFailure } from '../pipeline/pipeline-failure';
import type { Road } from '../roads/road';
import type { ForestTemplate } from './forest-template';
import type { PlacedClearing } from './placed-clearing';

export interface ForestResult {
  /** The generated map. */
  grid: Grid;
  /** The roads that were laid, with their centerlines and widths, and the paths to clearings after them. Empty without the `roads` option and without paths. */
  roads: Road[];
  /** The places where roads meet or cross. */
  junctions: Point[];
  /** The tiles on the map border where a road leaves the map. */
  exits: Point[];
  /** The streams that were laid, with their centerlines and widths, the water flowing from the first point to the last. Empty without the `streams` option. */
  streams: Road[];
  /** The bridges, one for every place where a road or a footbridge crosses water, at the tile nearest to the middle of the bridge. */
  bridges: Point[];
  /** The clearings that were made, with the shape they were given. Empty without the `clearings` option. */
  clearings: PlacedClearing[];
  /** The templates that were placed, with the box each one fills. Empty without the `templates` option. */
  templates: ForestTemplate[];
  /** How many times the forest was built, 1 or more: a map is built again when a step throws, up to 3 in all. */
  attempts: number;
  /** One entry per failed attempt, also when a later attempt succeeded. */
  failures: PipelineFailure[];
}
