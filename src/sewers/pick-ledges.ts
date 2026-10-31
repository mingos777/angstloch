import { pickRandom } from '../core/pick-random';
import type { Random } from '../core/random';
import { randomInt } from '../core/random-int';
import type { Range } from '../core/range';
import type { CisternSide } from './cistern-side';

/** The sides of a box, in order round it. */
const ROUND: readonly CisternSide[] = ['top', 'right', 'bottom', 'left'];

/**
 * The sides of a cistern that get a ledge: as many as drawn from `count`,
 * raised to hold every side in `needed`, and always sides next to each other
 * round the box, so that the ledges make one walkway.
 */
export function pickLedges(
  random: Random,
  count: Range,
  needed: readonly CisternSide[],
): CisternSide[] {
  const wanted = randomInt(random, count.min, count.max);
  for (let length = Math.max(wanted, 1); length < ROUND.length; ++length) {
    const runs = ROUND.map((_, start) =>
      Array.from(
        { length },
        (__, step) => ROUND[(start + step) % ROUND.length] as CisternSide,
      ),
    ).filter((run) => needed.every((side) => run.includes(side)));
    if (runs.length > 0) {
      return pickRandom(random, runs);
    }
  }
  return [...ROUND];
}
