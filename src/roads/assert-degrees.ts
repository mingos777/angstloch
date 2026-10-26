import { assertRange } from '../core/assert-range';
import type { Range } from '../core/range';

/** Throws a `RangeError` unless the range is whole degrees from 1 to 179. */
export function assertDegrees(name: string, range: Range): void {
  assertRange(name, range, 1);
  if (range.max > 179) {
    throw new RangeError(
      `${name}.max must be at most 179 degrees, got ${String(range.max)}`,
    );
  }
}
