import type { DistanceMetric } from './distance-metric';
import type { Tile } from './tile';

/** Options of `measureDistances`. */
export interface MeasureDistancesOptions {
  /** The cost factor of entering a tile, per `Tile` value: a positive number, or `Infinity` for a tile that cannot be entered. By default `Wall` and `DeepWater` are `Infinity` and every other tile is 1, doors included. A given entry replaces the default for that tile only. A factor below 1 makes a tile cheaper than plain ground, such as a road. */
  costs?: Partial<Record<Tile, number>>;
  /** How a step is measured: `'manhattan'` walks in 4 directions with steps of 1, `'chebyshev'` in 8 directions with steps of 1, and `'euclidean'` in 8 directions with diagonal steps of the square root of 2. A diagonal step may pass between two walls that touch at a corner. Defaults to `'euclidean'`. */
  metric?: DistanceMetric;
}
