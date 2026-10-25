import type { Area } from './area';
import type { Point } from './point';

/** A cavern: a group of floor tiles that are joined edge to edge. */
export interface CaveRegion {
  /** Number of floor tiles. */
  size: number;
  /** The floor tile of the region nearest to its center of mass. For a bent cavern this is a better spot than the middle of the bounds, which may be rock. */
  center: Point;
  /** The smallest rectangle that holds the region. */
  bounds: Area;
}
