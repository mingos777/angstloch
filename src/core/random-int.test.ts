import { describe, expect, it } from 'vitest';
import { randomInt } from './random-int';

describe('randomInt', () => {
  it('returns the minimum when the source yields 0', () => {
    // given
    const random = () => 0;

    // when
    const result = randomInt(random, 3, 7);

    // then
    expect(result).toBe(3);
  });

  it('returns the maximum when the source yields just below 1', () => {
    // given
    const random = () => 0.999999;

    // when
    const result = randomInt(random, 3, 7);

    // then
    expect(result).toBe(7);
  });

  it('returns the only possible value when min equals max', () => {
    // given
    const random = () => 0.5;

    // when
    const result = randomInt(random, 4, 4);

    // then
    expect(result).toBe(4);
  });
});
