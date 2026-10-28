import { describe, expect, it } from 'vitest';
import type { Grid } from '../core/grid';
import { Tile } from '../core/tile';
import { countAsymmetry } from '../test-helpers/count-asymmetry';
import { mulberry32 } from '../test-helpers/mulberry32';
import { generateNoiseCave } from './generate-noise-cave';
import type { NoiseCaveOptions } from './noise-cave-options';

/** Small noise features, so that the cave has caverns to join. */
const SMALL = { scaleX: 5, scaleY: 5 };

function cave(options: Partial<NoiseCaveOptions> = {}, seed = 1) {
  return generateNoiseCave({
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

describe('generateNoiseCave', () => {
  it('makes a map of the size that was asked for, with walls and floors', () => {
    // given
    const options = { width: 50, height: 30 };

    // when
    const { grid } = cave(options);

    // then
    expect([grid.width, grid.height]).toEqual([50, 30]);
    expect(count(grid, Tile.Wall)).toBeGreaterThan(0);
    expect(count(grid, Tile.Floor)).toBeGreaterThan(0);
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

  it.each([1, 2, 3, 4])(
    'joins all caverns into one by default (seed %i)',
    (seed) => {
      // given
      const separate = cave({ cave: SMALL, tunnels: false }, seed);

      // when
      const { regions } = cave({ cave: SMALL }, seed);

      // then
      expect(separate.regions.length).toBeGreaterThan(1);
      expect(regions).toHaveLength(1);
    },
  );

  it('passes the cave options to digNoiseCave', () => {
    // given
    const options = { cave: { fill: 1 } };

    // when
    const { grid, regions } = cave(options);

    // then
    expect(count(grid, Tile.Floor)).toBe(0);
    expect(regions).toEqual([]);
  });

  it('leaves out the caverns below minRegionSize', () => {
    // given
    const options = {
      cave: { ...SMALL, minRegionSize: 20 },
      tunnels: false,
    } as const;

    // when
    const { regions } = cave(options);

    // then
    expect(regions.length).toBeGreaterThan(0);
    expect(regions.every(({ size }) => size >= 20)).toBe(true);
  });

  it('carves the exits that were asked for into the border', () => {
    // given
    const options = { exits: { count: { min: 2, max: 2 } } };

    // when
    const { grid, exits } = cave(options);

    // then
    expect(exits).toHaveLength(2);
    for (const { x, y } of exits) {
      expect(grid.get(x, y)).toBe(Tile.Door);
    }
  });

  it('makes a perfectly symmetric cave with tunnels when both steps are given the symmetry', () => {
    // given
    const options = {
      cave: { ...SMALL, symmetry: 'rotational' },
      tunnels: { symmetry: 'rotational' },
    } as const;

    // when
    const { grid } = cave(options);

    // then
    expect(countAsymmetry(grid, 'rotational')).toBe(0);
  });

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
    ['height', { height: -1 }],
    ['fill', { cave: { fill: 1.1 } }],
    ['scaleX', { cave: { scaleX: 0 } }],
    ['windiness', { tunnels: { windiness: 2 } }],
    ['count', { exits: { count: { min: -1, max: 0 } } }],
  ])('throws a RangeError for an invalid %s', (name, options) => {
    // given
    const generate = () => cave(options);

    // when / then
    expect(generate).toThrow(RangeError);
    expect(generate).toThrow(name);
  });
});
