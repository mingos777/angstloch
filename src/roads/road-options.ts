import type { Range } from '../core/range';

/** Options of the roads of a map. */
export interface RoadOptions {
  /** Direction of the main road in degrees, clockwise from east, so 0 runs left to right and 90 top to bottom. The road runs from one edge of the map to the other. `random` picks an angle. Defaults to `random`. */
  angle?: number | 'random';
  /** Width of the main road, and of the roads that cross it, in tiles, a `Range` of whole numbers of at least 1. Defaults to 3. */
  width?: Range;
  /** How much the roads wind, from 0 (straight) to 1 (they may stray up to 12 tiles to either side of the straight line). Defaults to 0.3. */
  windiness?: number;
  /** Number of roads that cross the roads that are there, each through a point of one of them, so that they make a crossroads. Fewer are made when the map is too small to place them. Defaults to none. */
  crossings?: Range;
  /** The angle in whole degrees, from 1 to 179, at which a crossing road meets the road that it crosses, as a `Range`. It is picked at random, to the left or the right. Defaults to `{ min: 45, max: 90 }`. */
  crossingAngle?: Range;
  /** Number of branches, thinner paths that leave a road at a point of it. A branch may leave a crossing, or another branch. Fewer are made when the map is too small to place them. Defaults to none. */
  branches?: Range;
  /** Width of a branch in tiles, a `Range` of whole numbers of at least 1. Defaults to 1. */
  branchWidth?: Range;
  /** The angle in whole degrees, from 1 to 179, between a branch and the road it leaves, as a `Range`. A smaller angle makes the branch fork away gently. Defaults to `{ min: 20, max: 70 }`. */
  branchAngle?: Range;
  /** The length of a branch in tiles, as a `Range` of whole numbers of at least 1. A branch that is not long enough to reach the edge of the map ends in the forest. Without it a branch runs to the edge. */
  branchLength?: Range;
}
