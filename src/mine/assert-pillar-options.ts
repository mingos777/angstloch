import { assertFraction } from '../core/assert-fraction';
import { assertRange } from '../core/assert-range';
import type { DigPillarHallsOptions } from './dig-pillar-halls-options';

/** Throws a `RangeError` unless the options of the pillar halls are valid. The `area` is checked against the map later. */
export function assertPillarOptions(
  options: Omit<DigPillarHallsOptions, 'area'>,
): void {
  // widened, since the entrances may be added to
  const hallEntrances: string = options.hallEntrances ?? 'facing';
  if (hallEntrances !== 'facing' && hallEntrances !== 'edge') {
    throw new RangeError(
      `hallEntrances must be 'facing' or 'edge', got ${hallEntrances}`,
    );
  }
  for (const [name, value] of [
    ['density', options.density],
    ['hallRagged', options.hallRagged],
    ['pillarRagged', options.pillarRagged],
    ['pillarJitter', options.pillarJitter],
    ['veinWindiness', options.veinWindiness],
  ] as const) {
    if (value !== undefined) {
      assertFraction(name, value);
    }
  }
  for (const [name, range] of [
    ['halls', options.halls],
    ['hallVeins', options.hallVeins],
    ['hallSize', options.hallSize],
    ['pillarSize', options.pillarSize],
    ['pillarSpacing', options.pillarSpacing],
    ['veinWidth', options.veinWidth],
  ] as const) {
    if (range) {
      assertRange(name, range, 1);
    }
  }
  if (options.count) {
    assertRange('count', options.count, 0);
  }
}
