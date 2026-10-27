import type { Point } from '../core/point';
import type { CrossingPlan } from '../streams/crossing-plan';

/** Watches a forest being built, for the playground and the checker. */
export interface ForestObserver {
  /** Told the centerline of every generated road as it was grown, before it was bent to cross the streams. */
  grown?: (points: Point[]) => void;
  /** Told how every generated road that comes near a stream crosses the streams. */
  planned?: (plan: CrossingPlan) => void;
}
