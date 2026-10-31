import { describe, expect, it } from 'vitest';
import { snapToLattice } from './snap-to-lattice';

describe('snapToLattice', () => {
  it.each([
    [7, 3, 7],
    [8, 3, 7],
    [4, 4, 5],
    [2, 1, 1],
  ])('turns %i (range from %i) into %i', (size, min, expected) => {
    // given
    const range = { size, min };

    // when
    const snapped = snapToLattice(range.size, range.min);

    // then
    expect(snapped).toBe(expected);
  });
});
