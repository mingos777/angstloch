import { assertFraction } from '../core/assert-fraction';
import { assertRange } from '../core/assert-range';
import type { DigHallVeinsOptions } from './dig-hall-veins-options';

/** Throws a `RangeError` unless the options of the hall veins are valid. */
export function assertHallVeinOptions(options: DigHallVeinsOptions): void {
  // widened, since the entrances may be added to
  const hallEntrances: string = options.hallEntrances ?? 'facing';
  if (hallEntrances !== 'facing' && hallEntrances !== 'edge') {
    throw new RangeError(
      `hallEntrances must be 'facing' or 'edge', got ${hallEntrances}`,
    );
  }
  if (options.veinWindiness !== undefined) {
    assertFraction('veinWindiness', options.veinWindiness);
  }
  for (const [name, range] of [
    ['hallVeins', options.hallVeins],
    ['veinWidth', options.veinWidth],
  ] as const) {
    if (range) {
      assertRange(name, range, 1);
    }
  }
}
