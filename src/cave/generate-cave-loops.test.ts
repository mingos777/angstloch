import { describe, expect, it } from 'vitest';
import type { CaveOptions } from './cave-options';
import { generateCave } from './generate-cave';
import type { Grid } from '../core/grid';
import { mulberry32 } from '../test-helpers/mulberry32';
import { Tile } from '../core/tile';

const BASE = { width: 60, height: 40, fillChance: 0.5 };
const SEEDS = [1, 2, 3, 4, 5, 6, 7, 8];

function cave(options: Partial<CaveOptions>, seed: number) {
  return generateCave({ ...BASE, random: mulberry32(seed), ...options });
}

function floorCount(grid: Grid) {
  return grid.toString().split('.').length - 1;
}

describe('generateCave with tunnelLoops', () => {
  it('digs more tunnels than a tree needs', () => {
    // given
    const total = (tunnelLoops: number) =>
      SEEDS.reduce(
        (sum, seed) => sum + floorCount(cave({ tunnelLoops }, seed).grid),
        0,
      );

    // when
    const tree = total(0);
    const loops = total(1);

    // then
    expect(loops).toBeGreaterThan(tree);
  });

  it('makes the same cave as before with the default', () => {
    // given
    const seed = 3;

    // when
    const byDefault = cave({}, seed);
    const none = cave({ tunnelLoops: 0 }, seed);

    // then
    expect(byDefault.grid.toString()).toBe(none.grid.toString());
  });

  it('keeps every floor tile that the tree had', () => {
    // given
    const tree = cave({}, 5);

    // when
    const { grid } = cave({ tunnelLoops: 1 }, 5);

    // then
    for (let y = 0; y < grid.height; ++y) {
      for (let x = 0; x < grid.width; ++x) {
        if (tree.grid.get(x, y) === Tile.Floor) {
          expect(grid.get(x, y)).toBe(Tile.Floor);
        }
      }
    }
  });

  it('keeps the caverns joined into one', () => {
    // given
    const options = { tunnelLoops: 1 };

    // when
    const results = SEEDS.map((seed) => cave(options, seed));

    // then
    for (const { regions } of results) {
      expect(regions).toHaveLength(1);
    }
  });

  it('keeps the border solid', () => {
    // given
    const options = { tunnelLoops: 1, tunnelWidth: 2 };

    // when
    const { grid } = cave(options, 4);

    // then
    const rows = grid.toString().split('\n');
    expect(rows[0]).toBe('#'.repeat(60));
    expect(rows[39]).toBe('#'.repeat(60));
    expect(rows.every((row) => row.startsWith('#') && row.endsWith('#'))).toBe(
      true,
    );
  });

  it.each(['direct', 'winding'] as const)(
    'works with %s tunnels',
    (tunnelStyle) => {
      // given
      const options = { tunnelLoops: 1, tunnelStyle } as const;

      // when
      const { grid } = cave(options, 2);

      // then
      expect(floorCount(grid)).toBeGreaterThan(
        floorCount(cave({ tunnelStyle }, 2).grid),
      );
    },
  );

  it('digs the same loops for the same seed', () => {
    // given
    const options = { tunnelLoops: 0.5 };

    // when
    const a = cave(options, 9);
    const b = cave(options, 9);

    // then
    expect(a.grid.toString()).toBe(b.grid.toString());
  });

  it.each(['none', 'largest'] as const)(
    'has no effect with connect %s',
    (connect) => {
      // given
      const seed = 6;

      // when
      const plain = cave({ connect }, seed);
      const looped = cave({ connect, tunnelLoops: 1 }, seed);

      // then
      expect(looped.grid.toString()).toBe(plain.grid.toString());
    },
  );
});
