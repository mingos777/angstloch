import type { Point } from '../core/point';
import type { RoadKind } from './road-kind';

/**
 * One road that the caller asks for. A road is free-standing, or attached to
 * an earlier entry through `parent`. Where it cannot be laid exactly as
 * asked, it is bent or cut short.
 */
export interface RoadEntry {
  /** A `road` passes through its starting point in both directions, a `branch` leaves it in one. Defaults to `'road'`. */
  kind?: RoadKind;
  /** Width in tiles, a whole number of at least 1. Defaults to 3 for a road and 1 for a branch. */
  width?: number;
  /** How much the road winds, from 0 (straight) to 1. Defaults to the `windiness` of the road options. */
  windiness?: number;
  /** The index in the list of an earlier entry that this road is attached to. The road starts at a tile of that road, picked by `at`. */
  parent?: number;
  /** Where along the parent the road is attached, from 0 (its first tile) to 1 (its last). Defaults to 0.5. */
  at?: number;
  /** Where a free-standing road starts or passes, in tiles. Defaults to a random point near the middle of the map. Ignored when there is a `parent`. */
  origin?: Point;
  /** Direction in degrees, clockwise from east. Defaults to a random angle for a free-standing road and to a right angle to the parent for an attached one. Ignored when `to` is given. */
  angle?: number;
  /** The most tiles a branch runs. Without it, it runs until it leaves the map. Ignored when `to` is given. */
  length?: number;
  /** Where the road ends, in tiles. The road then runs from its start (`origin`, or the attachment point) to this point and ends there. Needs an `origin` or a `parent`. */
  to?: Point;
}
