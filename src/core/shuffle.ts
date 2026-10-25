import type { Random } from './random';
import { randomInt } from './random-int';

/** Returns the items in a random order, without changing the list that was passed in. */
export function shuffle<T>(random: Random, items: readonly T[]): T[] {
  const shuffled = [...items];
  for (let i = shuffled.length - 1; i > 0; --i) {
    const j = randomInt(random, 0, i);
    [shuffled[i], shuffled[j]] = [shuffled[j] as T, shuffled[i] as T];
  }
  return shuffled;
}
