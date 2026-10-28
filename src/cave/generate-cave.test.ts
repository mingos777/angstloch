import { describe, expect, it } from 'vitest';
import type { Grid } from '../core/grid';
import { Tile } from '../core/tile';
import { countAsymmetry } from '../test-helpers/count-asymmetry';
import { mulberry32 } from '../test-helpers/mulberry32';
import type { CaveOptions } from './cave-options';
import { generateCave } from './generate-cave';

function cave(options: Partial<CaveOptions> = {}, seed = 1) {
  return generateCave({
    width: 60,
    height: 40,
    random: mulberry32(seed),
    ...options,
  });
}

function count(grid: Grid, tile: Tile) {
  let total = 0;
  for (let y = 0; y < grid.height; ++y) {
    for (let x = 0; x < grid.width; ++x) {
      total += grid.get(x, y) === tile ? 1 : 0;
    }
  }
  return total;
}

describe('generateCave', () => {
  it('makes a map of the size that was asked for', () => {
    // given
    const options = { width: 30, height: 20 };

    // when
    const { grid } = cave(options);

    // then
    expect([grid.width, grid.height]).toEqual([30, 20]);
  });

  it('makes the same cave from the same seed', () => {
    // given
    const seed = 7;

    // when
    const first = cave({}, seed);
    const second = cave({}, seed);

    // then
    expect(first.grid.toString()).toBe(second.grid.toString());
  });

  it('makes another cave from another seed', () => {
    // given
    const first = cave({}, 1);

    // when
    const second = cave({}, 2);

    // then
    expect(first.grid.toString()).not.toBe(second.grid.toString());
  });

  it('does not require a random source', () => {
    // given
    const options = { width: 10, height: 10 };

    // when
    const { grid } = generateCave(options);

    // then
    expect(grid.width).toBe(10);
  });

  it('uses only walls and floors without exits', () => {
    // given
    const options = {};

    // when
    const { grid } = cave(options);

    // then
    expect(count(grid, Tile.Wall) + count(grid, Tile.Floor)).toBe(60 * 40);
  });

  it.each([1, 2, 3, 5])(
    'joins all caverns into one by default (seed %i)',
    (seed) => {
      // given
      const separate = cave({ tunnels: false }, seed);

      // when
      const { regions } = cave({}, seed);

      // then
      expect(separate.regions.length).toBeGreaterThan(1);
      expect(regions).toHaveLength(1);
    },
  );

  it('passes the tunnel options to digCaveTunnels', () => {
    // given
    const narrow = cave({}, 2);

    // when
    const wide = cave({ tunnels: { width: 3 } }, 2);

    // then
    expect(count(wide.grid, Tile.Floor)).toBeGreaterThan(
      count(narrow.grid, Tile.Floor),
    );
  });

  it('passes the cave options to growCave', () => {
    // given
    const options = { cave: { fillChance: 1, iterations: 0 } };

    // when
    const { grid, regions } = cave(options);

    // then
    expect(count(grid, Tile.Floor)).toBe(0);
    expect(regions).toEqual([]);
  });

  it('keeps only the largest cavern with largestOnly and no tunnels', () => {
    // given
    const loose = cave({ tunnels: false }, 2);

    // when
    const { grid, regions } = cave(
      { cave: { largestOnly: true }, tunnels: false },
      2,
    );

    // then
    expect(regions).toHaveLength(1);
    expect(regions[0]?.size).toBe(loose.regions[0]?.size);
    expect(count(grid, Tile.Floor)).toBe(regions[0]?.size);
  });

  it('reports the regions of the map, largest first', () => {
    // given
    const options = { tunnels: false } as const;

    // when
    const { regions } = cave(options, 2);

    // then
    const sizes = regions.map(({ size }) => size);
    expect(sizes.length).toBeGreaterThan(1);
    expect(sizes).toEqual([...sizes].sort((a, b) => b - a));
  });

  it('reports regions that add up to every floor tile', () => {
    // given
    const options = { tunnels: false } as const;

    // when
    const { grid, regions } = cave(options, 2);

    // then
    const total = regions.reduce((sum, { size }) => sum + size, 0);
    expect(total).toBe(count(grid, Tile.Floor));
  });

  it('reports a floor tile as the center of every region', () => {
    // given
    const options = { tunnels: false } as const;

    // when
    const { grid, regions } = cave(options, 2);

    // then
    for (const { center } of regions) {
      expect(grid.get(center.x, center.y)).toBe(Tile.Floor);
    }
  });

  it('adds no exits by default', () => {
    // given
    const options = {};

    // when
    const { exits } = cave(options);

    // then
    expect(exits).toEqual([]);
  });

  it('carves the exits that were asked for into the border', () => {
    // given
    const options = { exits: { count: { min: 3, max: 3 } } };

    // when
    const { grid, exits } = cave(options);

    // then
    expect(exits).toHaveLength(3);
    for (const { x, y } of exits) {
      expect(grid.get(x, y)).toBe(Tile.Door);
      expect(x === 0 || y === 0 || x === 59 || y === 39).toBe(true);
    }
  });

  it.each(['horizontal', 'vertical', 'both', 'rotational'] as const)(
    'makes a perfectly %s cave when every step is given the symmetry',
    (symmetry) => {
      // given
      const options = {
        cave: { symmetry, fillChance: 0.5 },
        tunnels: { symmetry },
        exits: { symmetry, count: { min: 4, max: 4 } },
      };

      // when
      const grids = [1, 2, 3].map((seed) => cave(options, seed).grid);

      // then
      for (const grid of grids) {
        expect(countAsymmetry(grid, symmetry)).toBe(0);
      }
    },
  );

  it('reports one attempt and no failures', () => {
    // given
    const options = {};

    // when
    const { attempts, failures } = cave(options);

    // then
    expect(attempts).toBe(1);
    expect(failures).toEqual([]);
  });

  it.each([
    ['width', { width: 0 }],
    ['height', { height: 2.5 }],
    ['fillChance', { cave: { fillChance: 1.5 } }],
    ['width', { tunnels: { width: 0 } }],
    ['count', { exits: { count: { min: -1, max: 1 } } }],
  ])('throws a RangeError for an invalid %s', (name, options) => {
    // given
    const generate = () => cave(options);

    // when / then
    expect(generate).toThrow(RangeError);
    expect(generate).toThrow(name);
  });
});
