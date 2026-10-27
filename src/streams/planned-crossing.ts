import type { Point } from '../core/point';

/** Where a road crosses a stream: in a straight line from the approach, over the bridge from the entry to the exit, to the departure. */
export interface PlannedCrossing {
  /** The tile a few tiles back from the bank, where the road is already heading straight across. */
  approach: Point;
  /** The last tile clear of the water before the bridge. */
  entry: Point;
  /** The first tile clear of the water after the bridge. */
  exit: Point;
  /** The tile a few tiles on from the bank, where the road may start to turn again. */
  departure: Point;
  /** The way the road runs across, in radians, clockwise from east. */
  direction: number;
}
