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

/** Picks one of the four directions, favouring horizontal ones or vertical ones by the biases. */
export function pickDirection(
  random: Random,
  horizontalBias: number,
  verticalBias: number,
): number {
  const horizontal = random() < horizontalShare(horizontalBias, verticalBias);
  return pickRandom(random, horizontal ? [1, 3] : [0, 2]);
}
