import { assertFraction } from '../core/assert-fraction';
import { assertRange } from '../core/assert-range';
import { assertWholeNumber } from '../core/assert-whole-number';
import type { DigVeinsOptions } from './dig-veins-options';

/** Throws a `RangeError` unless the options of the veins are valid. The `area` is checked against the map later. */
export function assertVeinOptions(
  options: Omit<DigVeinsOptions, 'area'>,
): void {
  for (const [name, value] of [
    ['density', options.density],
    ['veinWindiness', options.veinWindiness],
  ] as const) {
    if (value !== undefined) {
      assertFraction(name, value);
    }
  }
  if (options.veinWidth) {
    assertRange('veinWidth', options.veinWidth, 1);
  }
  if (options.veinSpacing !== undefined) {
    assertWholeNumber('veinSpacing', options.veinSpacing, 3);
  }
  if (options.count) {
    assertRange('count', options.count, 0);
  }
}
