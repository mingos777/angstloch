import { describe, expect, it } from 'vitest';
import { resolveSymmetryOptions } from './resolve-symmetry-options';

describe('resolveSymmetryOptions', () => {
  it('defaults to no symmetry and a chance of 1', () => {
    // given
    const options = {};

    // when
    const resolved = resolveSymmetryOptions(options);

    // then
    expect(resolved).toEqual({
      layoutSymmetry: 'none',
      layoutSymmetryChance: 1,
      corridorSymmetry: 'none',
      corridorSymmetryChance: 1,
    });
  });

  it('keeps the options that are given', () => {
    // given
    const options = {
      layoutSymmetry: 'both',
      layoutSymmetryChance: 0.5,
      corridorSymmetry: 'snowflake',
      corridorSymmetryChance: 0.25,
    } as const;

    // when
    const resolved = resolveSymmetryOptions(options);

    // then
    expect(resolved).toEqual(options);
  });
});
