import { describe, expect, it } from 'vitest';
import type { CaveOptions } from './cave-options';
import { countAsymmetry } from '../test-helpers/count-asymmetry';
import { generateCave } from './generate-cave';
import { mulberry32 } from '../test-helpers/mulberry32';

const BASE = { width: 61, height: 41, connect: 'none' } as const;

function cave(options: Partial<CaveOptions>, seed = 1) {
  return generateCave({ ...BASE, random: mulberry32(seed), ...options });
}

describe('generateCave with layoutSymmetry', () => {
  it.each(['horizontal', 'vertical', 'both', 'rotational'] as const)(
    'makes a perfectly %s cave at chance 1',
    (layoutSymmetry) => {
      // given
      const seeds = [1, 2, 3];

      // when
      const caves = seeds.map((seed) => cave({ layoutSymmetry }, seed));

      // then
      for (const { grid } of caves) {
        expect(countAsymmetry(grid, layoutSymmetry)).toBe(0);
      }
    },
  );

  it('stays symmetric on a map with even sides', () => {
    // given
    const options = { width: 60, height: 40, layoutSymmetry: 'both' } as const;

    // when
    const { grid } = cave(options);

    // then
    expect(countAsymmetry(grid, 'both')).toBe(0);
  });

  it('stays symmetric with the von Neumann neighborhood', () => {
    // given
    const options = {
      neighborhood: 'von-neumann',
      layoutSymmetry: 'rotational',
    } as const;

    // when
    const { grid } = cave(options);

    // then
    expect(countAsymmetry(grid, 'rotational')).toBe(0);
  });

  it('is roughly symmetric at a chance below 1, and less so than at 1', () => {
    // given
    const asymmetryAt = (layoutSymmetryChance: number) =>
      countAsymmetry(
        cave({ layoutSymmetry: 'both', layoutSymmetryChance }).grid,
        'both',
      );

    // when
    const [none, most, all] = [0, 0.9, 1].map(asymmetryAt);

    // then
    expect(none).toBeGreaterThan(most ?? 0);
    expect(most).toBeGreaterThan(all ?? 0);
  });

  it('makes the same cave as before without a symmetry', () => {
    // given
    const seed = 4;

    // when
    const byDefault = cave({}, seed);
    const none = cave(
      { layoutSymmetry: 'none', layoutSymmetryChance: 0 },
      seed,
    );

    // then
    expect(none.grid.toString()).toBe(byDefault.grid.toString());
  });

  it('digs the same cave for the same seed', () => {
    // given
    const options = {
      layoutSymmetry: 'both',
      layoutSymmetryChance: 0.7,
    } as const;

    // when
    const a = cave(options, 9);
    const b = cave(options, 9);

    // then
    expect(a.grid.toString()).toBe(b.grid.toString());
  });

  it.each([
    ['layoutSymmetry', { layoutSymmetry: 'diagonal' }],
    ['layoutSymmetryChance', { layoutSymmetryChance: 1.5 }],
    ['layoutSymmetryChance', { layoutSymmetryChance: -0.5 }],
  ])('throws a RangeError for an invalid %s', (name, options) => {
    // given
    const generate = () => cave(options as Partial<CaveOptions>);

    // when / then
    expect(generate).toThrow(RangeError);
    expect(generate).toThrow(name);
  });
});

describe('generateCave with tunnelSymmetryChance', () => {
  const SEEDS = [1, 2, 3, 4];

  it('has caverns to join in the caves of these tests', () => {
    // given
    const options = { fillChance: 0.5, layoutSymmetry: 'both' } as const;

    // when
    const results = SEEDS.map((seed) => cave(options, seed));

    // then
    const separate = results.filter(({ regions }) => regions.length > 1);
    expect(separate.length).toBeGreaterThanOrEqual(2);
  });

  it.each(['horizontal', 'vertical', 'both', 'rotational'] as const)(
    'digs perfectly %s tunnels at chance 1',
    (layoutSymmetry) => {
      // given
      const options = {
        connect: 'tunnel',
        fillChance: 0.5,
        layoutSymmetry,
      } as const;

      // when
      const results = SEEDS.map((seed) => cave(options, seed));

      // then
      for (const { grid, regions } of results) {
        expect(countAsymmetry(grid, layoutSymmetry)).toBe(0);
        expect(regions).toHaveLength(1);
      }
    },
  );

  it.each(['winding', 'direct'] as const)(
    'keeps %s tunnels of any width symmetric',
    (tunnelStyle) => {
      // given
      const options = {
        connect: 'tunnel',
        fillChance: 0.5,
        layoutSymmetry: 'both',
        tunnelStyle,
        tunnelWidth: 3,
        tunnelWindiness: 1,
      } as const;

      // when
      const { grid } = cave(options, 2);

      // then
      expect(countAsymmetry(grid, 'both')).toBe(0);
    },
  );

  it('keeps loops symmetric', () => {
    // given
    const options = {
      connect: 'tunnel',
      fillChance: 0.5,
      layoutSymmetry: 'both',
      tunnelLoops: 1,
    } as const;

    // when
    const results = SEEDS.map((seed) => cave(options, seed));

    // then
    for (const { grid } of results) {
      expect(countAsymmetry(grid, 'both')).toBe(0);
    }
  });

  it('keeps tunnels symmetric on a map with even sides', () => {
    // given
    const options = {
      width: 60,
      height: 40,
      connect: 'tunnel',
      fillChance: 0.5,
      layoutSymmetry: 'rotational',
      tunnelLoops: 0.5,
    } as const;

    // when
    const { grid } = cave(options, 3);

    // then
    expect(countAsymmetry(grid, 'rotational')).toBe(0);
  });

  it('makes tunnels without twins at chance 0', () => {
    // given
    const options = {
      connect: 'tunnel',
      fillChance: 0.5,
      layoutSymmetry: 'both',
      tunnelSymmetryChance: 0,
    } as const;

    // when
    const results = SEEDS.map((seed) => cave(options, seed));

    // then
    expect(results.some(({ grid }) => countAsymmetry(grid, 'both') > 0)).toBe(
      true,
    );
  });

  it('is more symmetric as the chance grows', () => {
    // given
    const total = (tunnelSymmetryChance: number) =>
      SEEDS.reduce(
        (sum, seed) =>
          sum +
          countAsymmetry(
            cave(
              {
                connect: 'tunnel',
                fillChance: 0.5,
                layoutSymmetry: 'both',
                tunnelSymmetryChance,
              },
              seed,
            ).grid,
            'both',
          ),
        0,
      );

    // when
    const [none, half, all] = [0, 0.5, 1].map(total);

    // then
    expect(none).toBeGreaterThan(half ?? 0);
    expect(half).toBeGreaterThan(all ?? 0);
  });

  it('has no effect without a layoutSymmetry', () => {
    // given
    const options = { connect: 'tunnel', fillChance: 0.5 } as const;

    // when
    const plain = cave({ ...options, tunnelSymmetryChance: 1 });
    const other = cave({ ...options, tunnelSymmetryChance: 0 });

    // then
    expect(other.grid.toString()).toBe(plain.grid.toString());
  });

  it('digs the same tunnels for the same seed', () => {
    // given
    const options = {
      connect: 'tunnel',
      fillChance: 0.5,
      layoutSymmetry: 'both',
      tunnelSymmetryChance: 0.5,
      tunnelLoops: 0.5,
    } as const;

    // when
    const a = cave(options, 9);
    const b = cave(options, 9);

    // then
    expect(a.grid.toString()).toBe(b.grid.toString());
  });

  it.each([1.5, -0.5])('throws a RangeError for a chance of %f', (chance) => {
    // given
    const generate = () => cave({ tunnelSymmetryChance: chance });

    // when / then
    expect(generate).toThrow(RangeError);
    expect(generate).toThrow('tunnelSymmetryChance');
  });
});

describe('generateCave exits with a layoutSymmetry', () => {
  const SEEDS = [1, 2, 3, 4];

  it.each(['horizontal', 'vertical', 'both', 'rotational'] as const)(
    'makes %s exits at chance 1, and the cave stays symmetric',
    (layoutSymmetry) => {
      // given
      const options = {
        connect: 'tunnel',
        layoutSymmetry,
        minExits: 4,
        maxExits: 4,
      } as const;

      // when
      const results = SEEDS.map((seed) => cave(options, seed));

      // then
      for (const { grid, exits } of results) {
        expect(countAsymmetry(grid, layoutSymmetry)).toBe(0);
        expect(exits.length).toBeGreaterThan(0);
        expect(exits.length).toBeLessThanOrEqual(4);
      }
    },
  );

  it('never makes more exits than maxExits, twins included', () => {
    // given
    const options = {
      layoutSymmetry: 'both',
      minExits: 1,
      maxExits: 3,
    } as const;

    // when
    const results = SEEDS.map((seed) => cave(options, seed));

    // then
    for (const { exits } of results) {
      expect(exits.length).toBeLessThanOrEqual(3);
    }
  });

  it('makes as many exits as asked for at a chance of 0', () => {
    // given
    const options = {
      layoutSymmetry: 'both',
      layoutSymmetryChance: 0,
      minExits: 4,
    } as const;

    // when
    const { exits } = cave(options, 2);

    // then
    expect(exits).toHaveLength(4);
  });

  it('makes the same exits as before without a symmetry', () => {
    // given
    const options = { minExits: 3, maxExits: 5 };

    // when
    const byDefault = cave(options, 6);
    const none = cave({ ...options, layoutSymmetry: 'none' }, 6);

    // then
    expect(none.exits).toEqual(byDefault.exits);
    expect(none.grid.toString()).toBe(byDefault.grid.toString());
  });

  it('digs the same exits for the same seed', () => {
    // given
    const options = {
      layoutSymmetry: 'both',
      layoutSymmetryChance: 0.6,
      minExits: 2,
      maxExits: 6,
    } as const;

    // when
    const a = cave(options, 8);
    const b = cave(options, 8);

    // then
    expect(a.exits).toEqual(b.exits);
  });
});
