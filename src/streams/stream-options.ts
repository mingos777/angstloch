import type { Range } from '../core/range';

/** Options of the streams of a map. A river is a stream with a larger `width`. */
export interface StreamOptions {
  /** Direction of the stream in degrees, clockwise from east, so 0 flows left to right and 90 top to bottom. The water flows that way. The stream runs from one edge of the map to the other. `random` picks an angle. Defaults to `random`. */
  angle?: number | 'random';
  /** Whether the stream rises at a spring inside the map, a point near the middle, and flows from it to the edge of the map the way of its `angle`, with no stream upstream. Without it the stream runs from one edge of the map to the other. Defaults to `false`. */
  spring?: boolean;
  /** Width of the stream in tiles, a `Range` of whole numbers of at least 1. Defaults to `{ min: 1, max: 2 }`. */
  width?: Range;
  /** How much the stream winds, from 0 (straight) to 1 (it may stray up to 12 tiles to either side of the straight line). Defaults to 0.5. */
  windiness?: number;
  /** How many tiles of shallow water the stream has on each side, a whole number of at least 0. The rest of the stream, in the middle, is deep. A stream that is no wider than twice this has no deep water, so with the default of 1 a stream of width 1 or 2 is all shallow and one of width 3 has a single band of deep water. Defaults to 1. */
  shoreWidth?: number;
  /** Number of tributaries, thinner streams that flow into a stream from the side, each leaving a point of it and running upstream. Fewer are made when the map is too small to place them. Defaults to none. */
  tributaries?: Range;
  /** Width of a tributary in tiles, a `Range` of whole numbers of at least 1. Defaults to 1. */
  tributaryWidth?: Range;
  /** The angle in whole degrees, from 1 to 179, between a tributary and the stream it joins, measured against the flow of the stream, as a `Range`. A smaller angle makes the tributary join gently, as real ones do. Defaults to `{ min: 30, max: 60 }`. */
  tributaryAngle?: Range;
  /** The length of a tributary in tiles, as a `Range` of whole numbers of at least 1. A tributary that is not long enough to reach the edge of the map starts in the forest, as at a spring. Without it a tributary runs to the edge. */
  tributaryLength?: Range;
}
