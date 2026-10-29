import type { DistanceMetric } from '../core/distance-metric';

/**
 * The strip beside a feature that a step keeps clear of ground cover (trees).
 * Within `clearance` tiles of the feature nothing grows; across the next
 * `falloff` tiles the chance of keeping what grows rises in equal steps, until
 * it is full.
 */
export interface Verge {
  /** How many tiles beside the feature have no ground cover at all, a whole number of at least 0. Tiles count in any direction, so a clearance of 1 clears all eight neighbors of a tile of the feature, diagonals included. Defaults to 0. */
  clearance?: number;
  /** How many tiles it takes the ground cover to thicken from none to full, beyond the `clearance`, a whole number of at least 0. With a falloff of 3 the first tile past the clearance keeps a quarter of its cover, the next half, the next three quarters, and the one after that all of it. Defaults to 0, where the cover is full right past the clearance. */
  falloff?: number;
  /** How the distance to the feature is measured: `'chebyshev'` counts a diagonal step as one tile and makes square verges, `'manhattan'` counts only orthogonal steps and makes diamonds, and `'euclidean'` measures the straight line between tile centers and makes round verges. Defaults to `'chebyshev'`. */
  distance?: DistanceMetric;
}
