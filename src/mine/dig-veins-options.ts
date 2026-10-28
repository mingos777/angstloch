import type { Range } from '../core/range';
import type { AreaSize } from '../pipeline/area-size';

/** Options of `digVeins`. */
export interface DigVeinsOptions {
  /** The share of the area that is floor, from 0 to 1. It is a target, met as far as the area has room: extra veins are dug until it is reached, and the veins that join the junctions are dug whatever it says. Defaults to 0.15. */
  density?: number;
  /** Width of a vein in whole tiles, as a `Range`. One is picked for every vein. Defaults to `{ min: 1, max: 2 }`. */
  veinWidth?: Range;
  /** How much the veins wind, from 0 (straight) to 1. Defaults to 0.5. */
  veinWindiness?: number;
  /** About how far apart the junctions of the web lie, in tiles, a whole number of at least 3. A larger value makes a coarser web with longer veins. Defaults to 16. */
  veinSpacing?: number;
  /** The size of the part of the map to dig in. Defaults to the whole map. A smaller area goes on a random free spot, and the mine is closed in by a ring of wall inside it. */
  area?: AreaSize;
  /** How many webs to dig, each in an area of its own, a `Range` of whole numbers of at least 0. One is picked. Defaults to `{ min: 1, max: 1 }`. */
  count?: Range;
}
