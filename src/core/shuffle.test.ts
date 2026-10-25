import { describe, expect, it } from 'vitest';
import { mulberry32 } from '../test-helpers/mulberry32';
import { shuffle } from './shuffle';

describe('shuffle', () => {
  it('returns the same items', () => {
    // given
    const items = [1, 2, 3, 4, 5, 6, 7, 8];

    // when
    const shuffled = shuffle(mulberry32(1), items);

    // then
    expect([...shuffled].sort((a, b) => a - b)).toEqual(items);
  });

  it('does not change the list that was passed in', () => {
    // given
    const items = [1, 2, 3, 4, 5];

    // when
    shuffle(mulberry32(1), items);

    // then
    expect(items).toEqual([1, 2, 3, 4, 5]);
  });

  it('changes the order', () => {
    // given
    const items = Array.from({ length: 20 }, (_, i) => i);

    // when
    const shuffled = shuffle(mulberry32(3), items);

    // then
    expect(shuffled).not.toEqual(items);
  });

  it('is deterministic for the same random source', () => {
    // given
    const items = Array.from({ length: 20 }, (_, i) => i);

    // when
    const a = shuffle(mulberry32(5), items);
    const b = shuffle(mulberry32(5), items);

    // then
    expect(a).toEqual(b);
  });

  it('differs between random sources', () => {
    // given
    const items = Array.from({ length: 20 }, (_, i) => i);

    // when
    const a = shuffle(mulberry32(5), items);
    const b = shuffle(mulberry32(6), items);

    // then
    expect(a).not.toEqual(b);
  });

  it('gives every item a chance to come first', () => {
    // given
    const items = [0, 1, 2, 3];

    // when
    const firsts = new Set(
      Array.from(
        { length: 60 },
        (_, seed) => shuffle(mulberry32(seed), items)[0],
      ),
    );

    // then
    expect(firsts.size).toBe(4);
  });

  it('handles empty and single lists', () => {
    // given
    const random = mulberry32(1);

    // when
    const results = [shuffle(random, []), shuffle(random, ['a'])];

    // then
    expect(results).toEqual([[], ['a']]);
  });
});
