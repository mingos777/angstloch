import { randomInt } from '../core/random-int';
import type { Random } from '../core/random';
import type { Range } from '../core/range';
import { snapToLattice } from './snap-to-lattice';

/** The size of one copy of an area along one side: a whole number from the range (`limit`, the size of the map, for a missing range), odd on a lattice. */
export function pickAreaSize(
  random: Random,
  range: Range | undefined,
  limit: number,
  lattice: boolean,
): number {
  const size = randomInt(random, range?.min ?? limit, range?.max ?? limit);
  return lattice ? snapToLattice(size, range?.min ?? limit) : size;
}
