import { assertFraction } from '../core/assert-fraction';
import { assertLayoutSymmetry } from '../core/assert-layout-symmetry';
import { assertRange } from '../core/assert-range';
import { assertWholeNumber } from '../core/assert-whole-number';
import type { CaveAreaOptions } from './cave-area-options';

/** Throws a `RangeError` unless the shared options of a cave step are valid. The `area` is checked against the map later. */
export function assertCaveAreaOptions(options: CaveAreaOptions): void {
  if (options.symmetry !== undefined) {
    assertLayoutSymmetry('symmetry', options.symmetry);
  }
  if (options.symmetryChance !== undefined) {
    assertFraction('symmetryChance', options.symmetryChance);
  }
  if (options.minRegionSize !== undefined) {
    assertWholeNumber('minRegionSize', options.minRegionSize, 0);
  }
  // widened, since the placements may be added to
  const placement: string = options.placement ?? 'free';
  if (
    placement !== 'free' &&
    placement !== 'beside' &&
    placement !== 'overlap'
  ) {
    throw new RangeError(
      `placement must be 'free', 'beside' or 'overlap', got ${placement}`,
    );
  }
  if (options.count) {
    assertRange('count', options.count, 0);
  }
}
