import type { Grid } from '../core/grid';
import type { Point } from '../core/point';
import type { Road } from '../roads/road';

export interface ForestResult {
  /** The generated map. */
  grid: Grid;
  /** The chance of a tree on every tile, from 0 to 1, row by row: `density[y * grid.width + x]`. A game can use it to tell dense woods from glades. */
  density: Float32Array;
  /** The roads that were laid, with their centerlines and widths. Empty without the `roads` option. */
  roads: Road[];
  /** The places where roads meet or cross. */
  junctions: Point[];
  /** The tiles on the map border where a road leaves the map. */
  exits: Point[];
}
