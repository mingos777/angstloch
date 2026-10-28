import { assertFraction } from '../core/assert-fraction';
import { assertWeight } from '../core/assert-weight';
import type { DigMazeOptions } from './dig-maze-options';
import type { MazeSymmetry } from './maze-options';

const PATTERNS: readonly MazeSymmetry[] = ['none', 'whirlpool', 'snowflake'];

/** Throws a `RangeError` unless the options of `digMaze` are valid as far as they can be told without the map. */
export function assertDigMazeOptions(options: DigMazeOptions): void {
  for (const [name, value] of [
    ['horizontalBias', options.horizontalBias],
    ['verticalBias', options.verticalBias],
  ] as const) {
    if (value !== undefined) {
      assertWeight(name, value);
    }
  }
  for (const [name, value] of [
    ['loopChance', options.loopChance],
    ['fill', options.fill],
    ['straight', options.straight],
    ['patternChance', options.patternChance],
  ] as const) {
    if (value !== undefined) {
      assertFraction(name, value);
    }
  }
  if (options.pattern !== undefined && !PATTERNS.includes(options.pattern)) {
    throw new RangeError(
      `pattern must be one of ${PATTERNS.join(', ')}, got ${options.pattern}`,
    );
  }
}
