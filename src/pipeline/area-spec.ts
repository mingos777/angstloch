import type { Range } from '../core/range';
import type { AreaGravity } from './area-gravity';
import type { AreaWindow } from './area-window';

/**
 * The part of the map a feature step builds in, the `area` option: its size,
 * and where it may go. A size is drawn from each range for every copy of the
 * feature. A missing range is the size of the map, so a step without an `area`
 * builds on the whole map. An area may be smaller than the map but never
 * larger. A window on an axis limits where the box goes along it; a missing
 * window leaves the axis free. Gravity, given instead of the windows, slides
 * the box toward a side, a corner or the middle.
 */
export interface AreaSpec {
  /** The width in tiles, whole numbers of at least 1. Defaults to the width of the map. */
  width?: Range;
  /** The height in tiles, whole numbers of at least 1. Defaults to the height of the map. */
  height?: Range;
  /** Where the box may go across the map: the columns its `anchor` may fall on. Defaults to anywhere. */
  x?: AreaWindow<'left' | 'center' | 'right'>;
  /** Where the box may go down the map: the rows its `anchor` may fall on. Defaults to anywhere. */
  y?: AreaWindow<'top' | 'center' | 'bottom'>;
  /** A pull toward a side, a corner or the middle of the map, which stops on whatever is in the way. Cannot be given with `x` or `y`. Defaults to none. */
  gravity?: AreaGravity;
}
