import type { Random } from './random';
import { randomInt } from './random-int';

/** Returns a random element of a non-empty list. */
export function pickRandom<T>(random: Random, items: readonly T[]): T {
  if (items.length === 0) {
    throw new RangeError('cannot pick from an empty list');
  }
  return items[randomInt(random, 0, items.length - 1)] as T;
}
