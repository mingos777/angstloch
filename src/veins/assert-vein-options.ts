import { assertLayoutSymmetry } from '../core/assert-layout-symmetry';
import { assertFraction } from '../core/assert-fraction';
import { assertRange } from '../core/assert-range';
import { assertWholeNumber } from '../core/assert-whole-number';
import type { DigVeinsOptions } from './dig-veins-options';

/** Throws a `RangeError` unless the options of the veins are valid. */
export function assertVeinOptions(options: DigVeinsOptions): void {
  for (const [name, value] of [
    ['density', options.density],
    ['veinWindiness', options.veinWindiness],
    ['symmetryChance', options.symmetryChance],
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
  if (options.symmetry !== undefined) {
    assertLayoutSymmetry('symmetry', options.symmetry);
  }
  const entrances: string | undefined = options.hallEntrances;
  if (
    entrances !== undefined &&
    entrances !== 'facing' &&
    entrances !== 'edge'
  ) {
    throw new RangeError(
      `hallEntrances must be 'facing' or 'edge', got ${entrances}`,
    );
  }
}
