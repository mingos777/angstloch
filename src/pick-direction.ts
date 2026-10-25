import { pickRandom } from './pick-random';
import type { Random } from './random';

/** Share of the weight that goes to horizontal directions, which is 0.5 when there is no bias. */
export function horizontalShare(
  horizontalBias: number,
  verticalBias: number,
): number {
  return horizontalBias + verticalBias > 0
    ? horizontalBias / (horizontalBias + verticalBias)
    : 0.5;
}

/** Picks one of the four directions, horizontal ones with a probability of `share`. */
export function pickDirection(random: Random, share: number): number {
  return pickRandom(random, random() < share ? [1, 3] : [0, 2]);
}
