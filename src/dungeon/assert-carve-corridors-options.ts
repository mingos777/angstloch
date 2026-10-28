import { assertFraction } from '../core/assert-fraction';
import { assertLayoutSymmetry } from '../core/assert-layout-symmetry';
import { assertRange } from '../core/assert-range';
import { assertWeight } from '../core/assert-weight';
import type { CorridorSymmetry } from '../rooms/corridor-symmetry';
import { assertConnection } from './assert-connection';
import type { CarveCorridorsOptions } from './carve-corridors-options';

const PATTERNS: readonly string[] = [
  'none',
  'whirlpool',
  'snowflake',
] satisfies CorridorSymmetry[];

/** Throws a `RangeError` unless the options of `carveCorridors` are valid. */
export function assertCarveCorridorsOptions(
  options: CarveCorridorsOptions,
): void {
  if (options.connection !== undefined) {
    assertConnection(options.connection);
  }
  // widened, since the placements may be added to
  const placement: string = options.placement ?? 'free';
  if (placement !== 'free' && placement !== 'lattice') {
    throw new RangeError(
      `placement must be 'free' or 'lattice', got ${placement}`,
    );
  }
  if (options.exitsPerRoom) {
    assertRange('exitsPerRoom', options.exitsPerRoom, 1);
  }
  for (const [name, value] of [
    ['loopChance', options.loopChance],
    ['deadEndChance', options.deadEndChance],
    ['doorChance', options.doorChance],
    ['straight', options.straight],
    ['symmetryChance', options.symmetryChance],
    ['corridorSymmetryChance', options.corridorSymmetryChance],
  ] as const) {
    if (value !== undefined) {
      assertFraction(name, value);
    }
  }
  for (const [name, value] of [
    ['horizontalBias', options.horizontalBias],
    ['verticalBias', options.verticalBias],
  ] as const) {
    if (value !== undefined) {
      assertWeight(name, value);
    }
  }
  if (options.symmetry !== undefined) {
    assertLayoutSymmetry('symmetry', options.symmetry);
  }
  const pattern: string = options.corridorSymmetry ?? 'none';
  if (!PATTERNS.includes(pattern)) {
    throw new RangeError(
      `corridorSymmetry must be one of ${PATTERNS.join(', ')}, got ${pattern}`,
    );
  }
}
