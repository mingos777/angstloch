import { assertFraction } from '../core/assert-fraction';
import { assertRange } from '../core/assert-range';
import type { DigSewersOptions } from './dig-sewers-options';

const ORIENTATIONS = ['horizontal', 'vertical', 'any'] as const;

/** Throws a `RangeError` unless the options of `digSewers` are valid. The `area` is checked against the map later (see `assertSewerArea`). */
export function assertDigSewersOptions(options: DigSewersOptions): void {
  if (
    options.orientation !== undefined &&
    !ORIENTATIONS.includes(options.orientation)
  ) {
    throw new RangeError(
      `orientation must be one of ${ORIENTATIONS.join(', ')}, got ${options.orientation}`,
    );
  }
  for (const [name, range, min] of [
    ['trunkWidth', options.trunkWidth, 1],
    ['branchWidth', options.branchWidth, 1],
    ['branches', options.branches, 0],
    ['branchLength', options.branchLength, 1],
    ['chamberSize', options.chamberSize, 1],
    ['cisterns', options.cisterns, 0],
    ['cisternSize', options.cisternSize, 1],
    ['cisternLedges', options.cisternLedges, 1],
    ['columnSpacing', options.columnSpacing, 1],
    ['count', options.count, 0],
  ] as const) {
    if (range) {
      assertRange(name, range, min);
    }
  }
  if (options.outfalls) {
    assertRange('outfalls', options.outfalls, 0);
    if (options.outfalls.max > 2) {
      throw new RangeError(
        `outfalls.max must be at most 2, the ends of the trunk, got ${String(options.outfalls.max)}`,
      );
    }
  }
  if (options.cisternLedges && options.cisternLedges.max > 4) {
    throw new RangeError(
      `cisternLedges.max must be at most 4, the sides of a cistern, got ${String(options.cisternLedges.max)}`,
    );
  }
  for (const [name, value] of [
    ['headChance', options.headChance],
    ['bridgeChance', options.bridgeChance],
    ['columnChance', options.columnChance],
  ] as const) {
    if (value !== undefined) {
      assertFraction(name, value);
    }
  }
}
