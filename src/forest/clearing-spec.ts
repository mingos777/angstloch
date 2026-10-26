import type { Range } from '../core/range';
import type { ClearingPathOptions } from './clearing-path-options';

/** A clearing that the caller asks for: a glade, free of trees, in the shape of a ragged oval. */
export interface ClearingSpec {
  /** The tile column of the center of the clearing, a whole number inside the map. Leave out `x` and `y` together to have the clearing placed at random. */
  x?: number;
  /** The tile row of the center of the clearing, a whole number inside the map. Leave out `x` and `y` together to have the clearing placed at random. */
  y?: number;
  /** Where to place the clearing instead of giving a center. `'branch-end'` puts it at the dead end of a branch, the end that lies inside the map. Each such clearing takes the next branch end in the order the branches were laid, and one that finds no branch end is left out. These clearings are never moved or dropped for overlapping others. `'stream'` centers it on a random tile of the centerline of a stream, so the stream runs through the clearing; it keeps away from the other clearings like a clearing at a random place, and is left out when there is no stream or no room. Cannot be combined with `x` and `y`. Defaults to none. */
  at?: 'branch-end' | 'stream';
  /** The approximate radius in tiles along the x axis, before `angle`, a `Range` of whole numbers of at least 1. A whole number in it is picked at random, and a range with `min` equal to `max` is exact. The ragged edge makes the real radius vary around it. */
  radiusX: Range;
  /** The approximate radius in tiles along the y axis, before `angle`, a `Range` like `radiusX`. Defaults to the radius picked for `radiusX`, which makes a circle. */
  radiusY?: Range;
  /** Clockwise rotation of the oval in degrees. Defaults to 0. */
  angle?: number;
  /** How ragged the edge is, from 0 (a plain oval) to 1 (very ragged). Defaults to 0.5. */
  irregularity?: number;
  /** How far from the nearest road tile the center of a clearing that is placed at random lies, in tiles, a `Range` of whole numbers of at least 0. Only used with roads, and only for a clearing without a center of its own. Defaults to `{ min: 8, max: 25 }`. */
  roadDistance?: Range;
  /** Leads a path to the clearing: `true` for the defaults, or the options of the path. The path starts at the nearest road, or at the nearest border of the map when there are no roads, and it ends in the center of the clearing. Defaults to no path. */
  path?: boolean | ClearingPathOptions;
}
