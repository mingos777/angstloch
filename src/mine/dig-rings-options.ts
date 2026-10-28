import type { Range } from '../core/range';
import type { AreaSize } from '../pipeline/area-size';
import type { MineRingShape } from './mine-ring-shape';

/** Options of `digRings`. */
export interface DigRingsOptions {
  /** The share of the area that is floor, from 0 to 1. It sets how many rings to dig when `rings` is not given. Defaults to 0.3. */
  density?: number;
  /** How many concentric rings to dig in each area, as a `Range`. One is picked, and fewer are dug when the area is too small to space them. Defaults to a count that makes the rings and their spokes fill about the `density` of the area. */
  rings?: Range;
  /** `oval` fits the rings to the area, so they are as wide and as tall as it is. `circle` makes them round, as large as the shorter side of the area allows, centered, which leaves the ends of a wide or tall area as rock. Defaults to `oval`. */
  ringShape?: MineRingShape;
  /** Width of a ring in whole tiles, as a `Range`. One is picked for every ring. Defaults to `{ min: 2, max: 3 }`. */
  ringWidth?: Range;
  /** How far the rings stray from perfect ovals, from 0 (perfect) to 1 (as far as they can without nearing the next ring). Defaults to 0.5. */
  ringWobble?: number;
  /** How many spokes join each ring to the next, as a `Range`. One is picked for every pair of rings, and every pair gets one at least, so a `min` of 0 is the same as 1. Defaults to `{ min: 1, max: 3 }`. */
  spokes?: Range;
  /** Width of a spoke in whole tiles, as a `Range`. One is picked for every spoke. Defaults to `{ min: 1, max: 2 }`. */
  veinWidth?: Range;
  /** How much the spokes wind, from 0 (straight) to 1. Defaults to 0.5. */
  veinWindiness?: number;
  /** The size of the part of the map to dig in. Defaults to the whole map. A smaller area goes on a random free spot, and the rings are fitted inside it, closed in by a ring of wall. */
  area?: AreaSize;
  /** How many sets of rings to dig, each in an area of its own, a `Range` of whole numbers of at least 0. One is picked. Defaults to `{ min: 1, max: 1 }`. */
  count?: Range;
}
