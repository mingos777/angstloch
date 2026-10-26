import type { Point } from '../core/point';

/** A straight run from a tile of one cavern to a tile of another. */
export interface CaveLink {
  from: Point;
  to: Point;
}
