import type { Point } from '../core/point';
import type { RoadKind } from './road-kind';

/** One road of a network. */
export interface Road {
  /** Whether this is a road or a branch. */
  kind: RoadKind;
  /** Width in tiles. */
  width: number;
  /** The tiles of the centerline, from one end to the other. Each is next to the one before it, edge to edge. */
  points: Point[];
}
