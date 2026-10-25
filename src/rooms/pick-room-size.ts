import { blend } from '../core/blend';
import type { Random } from '../core/random';
import type { Range } from '../core/range';

/**
 * Picks a room dimension from the range, which is expected to hold only valid
 * sizes at the given `step`. A `uniformity` of 1 always returns the middle of
 * the range.
 */
export function pickRoomSize(
  random: Random,
  range: Range,
  step: number,
  uniformity: number,
): number {
  const count = (range.max - range.min) / step + 1;
  const position = blend(random, uniformity);
  return range.min + step * Math.min(count - 1, Math.floor(position * count));
}
