import { assertFraction } from '../core/assert-fraction';
import { assertRange } from '../core/assert-range';
import { assertDegrees } from './assert-degrees';
import { assertRoadEntries } from './assert-road-entries';
import type { RoadOptions } from './road-options';

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
  if (options.specs) {
    assertRoadEntries(options.specs);
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
