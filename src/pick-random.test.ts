import { describe, expect, it } from 'vitest';
import { pickRandom } from './pick-random';

describe('pickRandom', () => {
  it('picks the element the source points at', () => {
    // given
    const random = () => 0.5;

    // when
    const result = pickRandom(random, ['a', 'b', 'c']);

    // then
    expect(result).toBe('b');
  });

  it('rejects an empty list', () => {
    // given
    const pick = () => pickRandom(() => 0, []);

    // when / then
    expect(pick).toThrow(RangeError);
  });
});
