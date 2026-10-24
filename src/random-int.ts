import type { Random } from './random';

/** Returns an integer between `min` and `max`, both inclusive. */
export function randomInt(random: Random, min: number, max: number): number {
  return min + Math.floor(random() * (max - min + 1));
}
