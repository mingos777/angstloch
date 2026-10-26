import type { Range } from '../core/range';
import type { ClearingPathOptions } from './clearing-path-options';

/** A clearing that the caller asks for: a glade, free of trees, in the shape of a ragged oval. */
export interface ClearingSpec {
  /** The tile column of the center of the clearing, a whole number inside the map. Leave out `x` and `y` together to have the clearing placed at random. */
  x?: number;
  /** The tile row of the center of the clearing, a whole number inside the map. Leave out `x` and `y` together to have the clearing placed at random. */
  y?: number;
  /** The approximate radius in tiles along the x axis, before `angle`, a positive number. The ragged edge makes the real radius vary around it. */
  radiusX: number;
  /** The approximate radius in tiles along the y axis, before `angle`, a positive number. Defaults to `radiusX`, which makes a circle. */
  radiusY?: number;
  /** Clockwise rotation of the oval in degrees. Defaults to 0. */
  angle?: number;
  /** How ragged the edge is, from 0 (a plain oval) to 1 (very ragged). Defaults to 0.5. */
  irregularity?: number;
  /** How far from the nearest road tile the center of a clearing that is placed at random lies, in tiles, a `Range` of whole numbers of at least 0. Only used with roads, and only for a clearing without a center of its own. Defaults to `{ min: 8, max: 25 }`. */
  roadDistance?: Range;
  /** Leads a path to the clearing: `true` for the defaults, or the options of the path. The path starts at the nearest road, or at the nearest border of the map when there are no roads, and it ends in the center of the clearing. Defaults to no path. */
  path?: boolean | ClearingPathOptions;
}
