import { describe, expect, it } from 'vitest';
import { countAsymmetry } from '../test-helpers/count-asymmetry';
import type { CaveNoiseOptions } from './create-cave-noise';
import { createCaveNoise } from './create-cave-noise';
import { mulberry32 } from '../test-helpers/mulberry32';

const BASE: CaveNoiseOptions = {
  width: 41,
  height: 30,
  fillChance: 0.5,
  borderWalls: true,
  symmetry: 'none',
  symmetryChance: 1,
};

function noise(options: Partial<CaveNoiseOptions>, seed = 1) {
  return createCaveNoise(mulberry32(seed), { ...BASE, ...options });
}

describe('createCaveNoise', () => {
  it.each(['horizontal', 'vertical', 'both', 'rotational'] as const)(
    'is perfectly %s at chance 1',
    (symmetry) => {
      // given
      const options = { symmetry, symmetryChance: 1 };

      // when
      const odd = noise({ ...options, width: 41, height: 31 });
      const even = noise({ ...options, width: 40, height: 30 });

      // then
      expect(countAsymmetry(odd, symmetry)).toBe(0);
      expect(countAsymmetry(even, symmetry)).toBe(0);
    },
  );

  it('is not symmetric at chance 0', () => {
    // given
    const options = { symmetry: 'both', symmetryChance: 0 } as const;

    // when
    const grid = noise(options);

    // then
    expect(countAsymmetry(grid, 'both')).toBeGreaterThan(200);
  });

  it('is more symmetric as the chance grows', () => {
    // given
    const asymmetryAt = (symmetryChance: number) =>
      countAsymmetry(noise({ symmetry: 'both', symmetryChance }), 'both');

    // when
    const [none, some, all] = [0, 0.5, 1].map(asymmetryAt);

    // then
    expect(none).toBeGreaterThan(some ?? 0);
    expect(some).toBeGreaterThan(all ?? 0);
  });

  it('ignores the chance without a symmetry', () => {
    // given
    const plain = noise({ symmetry: 'none', symmetryChance: 1 });

    // when
    const other = noise({ symmetry: 'none', symmetryChance: 0 });

    // then
    expect(other.toString()).toBe(plain.toString());
  });

  it('keeps the border solid with borderWalls', () => {
    // given
    const options = { symmetry: 'both', borderWalls: true } as const;

    // when
    const rows = noise(options).toString().split('\n');

    // then
    expect(rows[0]).toBe('#'.repeat(41));
    expect(rows[29]).toBe('#'.repeat(41));
    expect(rows.every((row) => row.startsWith('#') && row.endsWith('#'))).toBe(
      true,
    );
  });

  it('can have floor on the border without borderWalls', () => {
    // given
    const options = { symmetry: 'both', borderWalls: false } as const;

    // when
    const grid = noise(options);

    // then
    expect(grid.toString().split('\n')[0]).toContain('.');
  });
});
