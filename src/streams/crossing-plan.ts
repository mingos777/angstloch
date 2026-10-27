import type { Point } from '../core/point';
import type { PlannedCrossing } from './planned-crossing';

/** How a road gets across the streams: from its start through its crossings, in order, to its end. */
export interface CrossingPlan {
  /** The width of the road, in tiles. */
  width: number;
  /** The tiles of the road as grown that are kept before `start`, where an end that cannot move lies close to the water. */
  head: Point[];
  /** Where the laid road starts: the end of the road, moved along the border when it lay in or beside the water. */
  start: Point;
  crossings: PlannedCrossing[];
  /** Where the laid road ends, as for `start`. */
  end: Point;
  /** The tiles of the road as grown that are kept after `end`. */
  tail: Point[];
}
