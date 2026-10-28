import { assertFraction } from '../core/assert-fraction';
import { assertRange } from '../core/assert-range';
import type { DigFishboneOptions } from './dig-fishbone-options';

/** Throws a `RangeError` unless the options of the fishbone are valid. The `area` is checked against the map later. */
export function assertFishboneOptions(
  options: Omit<DigFishboneOptions, 'area'>,
): void {
  const { angle = 'random' } = options;
  if (angle !== 'random' && !Number.isFinite(angle)) {
    throw new RangeError(
      `angle must be a finite number or 'random', got ${String(angle)}`,
    );
  }
  for (const [name, value] of [
    ['density', options.density],
    ['shaftWindiness', options.shaftWindiness],
    ['aditWindiness', options.aditWindiness],
    ['loops', options.loops],
  ] as const) {
    if (value !== undefined) {
      assertFraction(name, value);
    }
  }
  for (const [name, range] of [
    ['shaftWidth', options.shaftWidth],
    ['aditWidth', options.aditWidth],
    ['aditLength', options.aditLength],
    ['branchAngle', options.branchAngle],
  ] as const) {
    if (range) {
      assertRange(name, range, 1);
    }
  }
  if (options.branchAngle && options.branchAngle.max > 179) {
    throw new RangeError(
      `branchAngle.max must be at most 179 degrees, got ${String(options.branchAngle.max)}`,
    );
  }
  if (options.count) {
    assertRange('count', options.count, 0);
  }
}
