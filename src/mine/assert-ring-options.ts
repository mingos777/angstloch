import { assertFraction } from '../core/assert-fraction';
import { assertRange } from '../core/assert-range';
import type { DigRingsOptions } from './dig-rings-options';

/** Throws a `RangeError` unless the options of the rings are valid. The `area` is checked against the map later. */
export function assertRingOptions(
  options: Omit<DigRingsOptions, 'area'>,
): void {
  // widened, since the shapes may be added to
  const ringShape: string = options.ringShape ?? 'oval';
  if (ringShape !== 'oval' && ringShape !== 'circle') {
    throw new RangeError(
      `ringShape must be 'oval' or 'circle', got ${ringShape}`,
    );
  }
  for (const [name, value] of [
    ['density', options.density],
    ['ringWobble', options.ringWobble],
    ['veinWindiness', options.veinWindiness],
  ] as const) {
    if (value !== undefined) {
      assertFraction(name, value);
    }
  }
  for (const [name, range] of [
    ['rings', options.rings],
    ['ringWidth', options.ringWidth],
    ['veinWidth', options.veinWidth],
  ] as const) {
    if (range) {
      assertRange(name, range, 1);
    }
  }
  if (options.spokes) {
    assertRange('spokes', options.spokes, 0);
  }
  if (options.count) {
    assertRange('count', options.count, 0);
  }
}
