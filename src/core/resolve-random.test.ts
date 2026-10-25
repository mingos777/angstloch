import { describe, expect, it } from 'vitest';
import { resolveRandom } from './resolve-random';

describe('resolveRandom', () => {
  it('returns the injected source when provided', () => {
    // given
    const random = () => 0.5;

    // when
    const result = resolveRandom(random);

    // then
    expect(result).toBe(random);
  });

  it('falls back to Math.random when nothing is injected', () => {
    // given
    const random = undefined;

    // when
    const result = resolveRandom(random);

    // then
    expect(result).toBe(Math.random);
  });
});
