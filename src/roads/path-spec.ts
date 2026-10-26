import type { Point } from '../core/point';
import type { RoadKind } from './road-kind';

/** What path to add to a road map: a road with both of its ends fixed. */
export interface PathSpec {
  kind: RoadKind;
  /** Width in tiles. */
  width: number;
  /** Where the path starts, in tile units, where tile `(i, j)` covers `[i, i + 1)`. */
  from: Point;
  /** Where the path ends, in the same units. */
  to: Point;
  /** How much the path winds, from 0 (straight) to 1. Defaults to the windiness of the road map. */
  windiness?: number;
}
