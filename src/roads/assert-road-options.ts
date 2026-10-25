import { assertFraction } from '../core/assert-fraction';
import { assertRange } from '../core/assert-range';
import type { Range } from '../core/range';
import type { RoadOptions } from './road-options';

/** Throws a `RangeError` unless the range is whole degrees from 1 to 179. */
function assertDegrees(name: string, range: Range): void {
  assertRange(name, range, 1);
  if (range.max > 179) {
    throw new RangeError(
      `${name}.max must be at most 179 degrees, got ${String(range.max)}`,
    );
  }
}

/** Throws a `RangeError` unless the road options are valid. */
export function assertRoadOptions(options: RoadOptions): void {
  const { angle = 'random', windiness } = options;
  if (angle !== 'random' && !Number.isFinite(angle)) {
    throw new RangeError(
      `roads.angle must be a finite number or 'random', got ${String(angle)}`,
    );
  }
  if (windiness !== undefined) {
    assertFraction('roads.windiness', windiness);
  }
  for (const [name, range] of [
    ['roads.width', options.width],
    ['roads.branchWidth', options.branchWidth],
    ['roads.branchLength', options.branchLength],
  ] as const) {
    if (range) {
      assertRange(name, range, 1);
    }
  }
  for (const [name, range] of [
    ['roads.crossings', options.crossings],
    ['roads.branches', options.branches],
  ] as const) {
    if (range) {
      assertRange(name, range, 0);
    }
  }
  for (const [name, range] of [
    ['roads.crossingAngle', options.crossingAngle],
    ['roads.branchAngle', options.branchAngle],
  ] as const) {
    if (range) {
      assertDegrees(name, range);
    }
  }
}
