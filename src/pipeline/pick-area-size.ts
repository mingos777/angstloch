import { randomInt } from '../core/random-int';
import type { Random } from '../core/random';
import type { Range } from '../core/range';

/** The size of one copy of an area along one side: a whole number from the range (`limit`, the size of the map, for a missing range), odd on a lattice. */
export function pickAreaSize(
  random: Random,
  range: Range | undefined,
  limit: number,
  lattice: boolean,
): number {
  const size = randomInt(random, range?.min ?? limit, range?.max ?? limit);
  if (!lattice || size % 2 === 1) {
    return size;
  }
  // the next odd size down, or up when that would be 0 or the range does not reach it
  return size - 1 >= (range?.min ?? limit) && size > 1 ? size - 1 : size + 1;
}
