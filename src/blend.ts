import type { Random } from './random';

/**
 * Returns a position in [0, 1) that is uniformly random at a `uniformity` of
 * 0 and pulled towards the middle as it grows, until at 1 it is always 0.5.
 */
export function blend(random: Random, uniformity: number): number {
  return 0.5 + (random() - 0.5) * (1 - uniformity);
}
