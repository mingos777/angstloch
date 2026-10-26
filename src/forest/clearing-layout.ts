import type { Point } from '../core/point';
import type { DistanceMetric } from '../roads/distance-metric';

/** What `layClearings` needs besides the clearings themselves. */
export interface ClearingLayout {
  /** Extra tiles that random clearings keep beyond their radii from other clearings. Defaults to 0. */
  spacing?: number;
  /** The tiles that roads cover, one flag per tile row by row, and how distances to them are measured. Random clearings keep the `roadDistance` of their spec from these. Left out when there are no roads. */
  /** The dead ends of the branches that lie inside the map, in the order the branches were laid, for the clearings that are `at` a `'branch-end'`. Defaults to none. */
  branchEnds?: readonly Point[];
  roads?: { covered: Uint8Array; metric: DistanceMetric };
}
