import type { Range } from '../core/range';

/**
 * The size of the part of the map a feature step builds in, the `area` option.
 * A size is drawn from each range for every copy of the feature. A missing
 * range is the size of the map, so a step without an `area` builds on the whole
 * map. An area may be smaller than the map but never larger.
 */
export interface AreaSize {
  /** The width in tiles, whole numbers of at least 1. Defaults to the width of the map. */
  width?: Range;
  /** The height in tiles, whole numbers of at least 1. Defaults to the height of the map. */
  height?: Range;
}
