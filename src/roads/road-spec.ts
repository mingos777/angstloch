import type { Point } from '../core/point';
import type { RoadKind } from './road-kind';

/** What road to add to a road map. */
export interface RoadSpec {
  kind: RoadKind;
  /** Width in tiles. */
  width: number;
  /** Where the road starts or passes, in tile units, where tile `(i, j)` covers `[i, i + 1)`. */
  origin: Point;
  /** Direction in radians, clockwise from east. */
  angle: number;
  /** Which ways to grow from the origin: 1 forwards, -1 backwards. Both makes a road that passes through the origin, one a road that leaves it. */
  directions: readonly (1 | -1)[];
  /** Stops a road that leaves the origin after this many tiles. Without it the road runs until it leaves the map. */
  maxLength?: number;
  /** How much the road winds, from 0 (straight) to 1. Defaults to the windiness of the road map. */
  windiness?: number;
  /** Changes the centerline once it is grown, before it is laid. It is told the width of the road as well. */
  reshape?: (points: Point[], width: number) => Point[];
}
