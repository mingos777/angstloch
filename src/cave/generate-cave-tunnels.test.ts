import { describe, expect, it } from 'vitest';
import type { CaveOptions } from './cave-options';
import { generateCave } from './generate-cave';
import type { Grid } from '../core/grid';
import { mulberry32 } from '../test-helpers/mulberry32';
import { Tile } from '../core/tile';

const BASE = { width: 60, height: 40, fillChance: 0.5 };

function cave(options: Partial<CaveOptions>, seed: number) {
  return generateCave({ ...BASE, random: mulberry32(seed), ...options });
}

function floorCount(grid: Grid) {
  return grid.toString().split('.').length - 1;
}

describe('generateCave with tunnels', () => {
  it.each([1, 2, 3, 4, 5, 6])(
    'joins all caverns into one by default (seed %i)',
    (seed) => {
      // given
      const separate = cave({ connect: 'none' }, seed);

      // when
      const { regions } = cave({}, seed);

      // then
      expect(separate.regions.length).toBeGreaterThan(1);
      expect(regions).toHaveLength(1);
    },
  );

  it.each(['winding', 'direct'] as const)(
    'joins all caverns with %s tunnels',
    (tunnelStyle) => {
      // given
      const options = { connect: 'tunnel', tunnelStyle } as const;

      // when
      const { regions } = cave(options, 7);

      // then
      expect(regions).toHaveLength(1);
    },
  );

  it('keeps every floor tile that was there before', () => {
    // given
    const separate = cave({ connect: 'none' }, 3);

    // when
    const { grid } = cave({}, 3);

    // then
    expect(floorCount(grid)).toBeGreaterThan(floorCount(separate.grid));
    for (let y = 0; y < grid.height; ++y) {
      for (let x = 0; x < grid.width; ++x) {
        if (separate.grid.get(x, y) === Tile.Floor) {
          expect(grid.get(x, y)).toBe(Tile.Floor);
        }
      }
    }
  });

  it('keeps the border solid', () => {
    // given
    const options = { tunnelWidth: 3, tunnelWindiness: 1 };

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

  it('can tunnel through the border without borderWalls', () => {
    // given
    const options = { borderWalls: false, tunnelWidth: 2 };

    // when
    const { regions } = cave(options, 5);

    // then
    expect(regions).toHaveLength(1);
  });

  it('digs wider tunnels with tunnelWidth', () => {
    // given
    const options = { tunnelStyle: 'direct' } as const;

    // when
    const narrow = cave({ ...options, tunnelWidth: 1 }, 3);
    const wide = cave({ ...options, tunnelWidth: 3 }, 3);

    // then
    expect(floorCount(wide.grid)).toBeGreaterThan(floorCount(narrow.grid));
  });

  it('digs longer tunnels as the windiness grows', () => {
    // given
    const seeds = [1, 2, 3, 4, 5, 6, 7, 8];
    const total = (tunnelWindiness: number) =>
      seeds.reduce(
        (sum, seed) => sum + floorCount(cave({ tunnelWindiness }, seed).grid),
        0,
      );

    // when
    const straight = total(0);
    const wandering = total(1);

    // then
    expect(wandering).toBeGreaterThan(straight);
  });

  it('digs the same tunnels for the same seed', () => {
    // given
    const options = { tunnelWindiness: 0.8 };

    // when
    const a = cave(options, 9);
    const b = cave(options, 9);

    // then
    expect(a.grid.toString()).toBe(b.grid.toString());
  });

  it('fills in small caverns before joining the rest', () => {
    // given
    const separate = cave({ connect: 'none', minRegionSize: 40 }, 2);

    // when
    const { regions } = cave({ minRegionSize: 40 }, 2);

    // then
    expect(separate.regions.length).toBeGreaterThan(1);
    expect(regions).toHaveLength(1);
    expect(regions[0]?.size).toBeGreaterThanOrEqual(
      separate.regions.reduce((sum, region) => sum + region.size, 0),
    );
  });

  it('has nothing to join on a map without floor', () => {
    // given
    const options = { fillChance: 1 };

    // when
    const { regions } = cave(options, 1);

    // then
    expect(regions).toEqual([]);
  });

  it.each([
    ['tunnelWidth', { tunnelWidth: 0 }],
    ['tunnelWidth', { tunnelWidth: 1.5 }],
    ['tunnelWindiness', { tunnelWindiness: 1.5 }],
    ['tunnelLoops', { tunnelLoops: 1.5 }],
    ['tunnelLoops', { tunnelLoops: -0.1 }],
  ])('throws a RangeError for an invalid %s', (name, options) => {
    // given
    const generate = () => cave(options, 1);

    // when / then
    expect(generate).toThrow(RangeError);
    expect(generate).toThrow(name);
  });
});
