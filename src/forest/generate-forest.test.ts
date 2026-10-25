import { describe, expect, it } from 'vitest';
import type { Grid } from '../core/grid';
import { Tile } from '../core/tile';
import { mulberry32 } from '../test-helpers/mulberry32';
import type { ForestOptions } from './forest-options';
import { generateForest } from './generate-forest';

/** The widest range of chances: bare where the noise is lowest, solid where it is highest. */
const FULL = { minDensity: 0, maxDensity: 1 };

function forest(options: Partial<ForestOptions> = {}, seed = 1) {
  return generateForest({
    width: 80,
    height: 60,
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

describe('generateForest', () => {
  it('returns a grid of the requested size', () => {
    // given
    const options = { width: 30, height: 20 };

    // when
    const { grid } = forest(options);

    // then
    expect([grid.width, grid.height]).toEqual([30, 20]);
  });

  it('is deterministic for the same seed', () => {
    // given
    const options = {};

    // when
    const a = forest(options, 3);
    const b = forest(options, 3);

    // then
    expect(a.grid.toString()).toBe(b.grid.toString());
    expect(a.density).toEqual(b.density);
  });

  it('differs between seeds', () => {
    // given
    const options = {};

    // when
    const a = forest(options, 1);
    const b = forest(options, 2);

    // then
    expect(a.grid.toString()).not.toBe(b.grid.toString());
  });

  it('uses only grass and trees by default', () => {
    // given
    const options = {};

    // when
    const { grid } = forest(options);

    // then
    expect(count(grid, Tile.Grass) + count(grid, Tile.Tree)).toBe(80 * 60);
    expect(count(grid, Tile.Tree)).toBeGreaterThan(0);
    expect(count(grid, Tile.Grass)).toBeGreaterThan(0);
  });

  it('can use other tiles for ground and trees', () => {
    // given
    const options = { groundTile: Tile.Floor, treeTile: Tile.Wall };

    // when
    const { grid } = forest(options);

    // then
    expect(count(grid, Tile.Floor) + count(grid, Tile.Wall)).toBe(80 * 60);
    expect(count(grid, Tile.Grass) + count(grid, Tile.Tree)).toBe(0);
  });

  it('reports a chance for every tile', () => {
    // given
    const options = { width: 50, height: 30 };

    // when
    const { density } = forest(options);

    // then
    expect(density).toHaveLength(50 * 30);
    expect(density.every((chance) => chance >= 0 && chance <= 1)).toBe(true);
  });

  it('puts no trees where the chance is 0 and trees everywhere the chance is 1', () => {
    // given
    const options = FULL;

    // when
    const { grid, density } = forest(options);

    // then
    for (let y = 0; y < grid.height; ++y) {
      for (let x = 0; x < grid.width; ++x) {
        const chance = density[y * grid.width + x];
        if (chance === 0) {
          expect(grid.get(x, y)).toBe(Tile.Grass);
        }
        if (chance === 1) {
          expect(grid.get(x, y)).toBe(Tile.Tree);
        }
      }
    }
  });

  it('has no trees when both densities are 0', () => {
    // given
    const options = { minDensity: 0, maxDensity: 0 };

    // when
    const { grid } = forest(options);

    // then
    expect(count(grid, Tile.Tree)).toBe(0);
  });

  it('is all trees when both densities are 1', () => {
    // given
    const options = { minDensity: 1, maxDensity: 1 };

    // when
    const { grid } = forest(options);

    // then
    expect(count(grid, Tile.Grass)).toBe(0);
  });

  it('scatters trees evenly when both densities are the same', () => {
    // given
    const options = {
      width: 100,
      height: 100,
      minDensity: 0.3,
      maxDensity: 0.3,
    };

    // when
    const { grid, density } = forest(options);

    // then
    expect(
      density.every(
        (chance) => chance === 0.3 || Math.abs(chance - 0.3) < 1e-6,
      ),
    ).toBe(true);
    const share = count(grid, Tile.Tree) / (100 * 100);
    expect(share).toBeGreaterThan(0.27);
    expect(share).toBeLessThan(0.33);
  });

  it('averages out between the two densities', () => {
    // given
    const options = {
      width: 200,
      height: 200,
      minDensity: 0.2,
      maxDensity: 0.6,
    };

    // when
    const { grid } = forest(options);

    // then
    const share = count(grid, Tile.Tree) / (200 * 200);
    expect(share).toBeGreaterThan(0.3);
    expect(share).toBeLessThan(0.5);
  });

  it('keeps every chance between the two densities', () => {
    // given
    const options = { minDensity: 0.1, maxDensity: 0.4 };

    // when
    const { density } = forest(options);

    // then
    expect(Math.min(...density)).toBeGreaterThanOrEqual(0.1 - 1e-6);
    expect(Math.max(...density)).toBeLessThanOrEqual(0.4 + 1e-6);
  });

  it('spreads the chance over most of the range between the densities', () => {
    // given
    const options = {
      width: 200,
      height: 200,
      minDensity: 0.1,
      maxDensity: 0.9,
    };

    // when
    const { density } = forest(options);

    // then
    expect(Math.min(...density)).toBeLessThan(0.3);
    expect(Math.max(...density)).toBeGreaterThan(0.7);
  });

  it('makes sparse woods by default, with at most a quarter of the tiles as trees', () => {
    // given
    const options = { width: 200, height: 200 };

    // when
    const { grid, density } = forest(options);

    // then
    expect(Math.max(...density)).toBeLessThanOrEqual(0.25 + 1e-6);
    expect(Math.min(...density)).toBeGreaterThanOrEqual(0);
    const share = count(grid, Tile.Tree) / (200 * 200);
    expect(share).toBeGreaterThan(0.03);
    expect(share).toBeLessThan(0.2);
  });

  it.each([
    [-1, 0.1],
    [0, 0.25],
    [1, 0.4],
  ])('maps the noise value %f to the chance %f', (value, expected) => {
    // given
    const options = {
      width: 2,
      height: 2,
      minDensity: 0.1,
      maxDensity: 0.4,
      noise: () => value,
    };

    // when
    const { density } = forest(options);

    // then
    expect(density[0]).toBeCloseTo(expected);
  });

  it('puts the trees where the noise is lowest when minDensity is the larger', () => {
    // given
    const options = { minDensity: 1, maxDensity: 0, noise: () => -1 };

    // when
    const { grid } = forest(options);

    // then
    expect(count(grid, Tile.Grass)).toBe(0);
  });

  it('changes the chance smoothly from tile to tile', () => {
    // given
    const options = { ...FULL };

    // when
    const { density } = forest(options);

    // then
    let biggestJump = 0;
    for (let y = 0; y < 60; ++y) {
      for (let x = 1; x < 80; ++x) {
        biggestJump = Math.max(
          biggestJump,
          Math.abs((density[y * 80 + x] ?? 0) - (density[y * 80 + x - 1] ?? 0)),
        );
      }
    }
    expect(biggestJump).toBeLessThan(0.25);
  });

  it('makes broader woods with a larger scale', () => {
    // given
    const roughness = (scale: number) => {
      const { density } = forest({ scaleX: scale, scaleY: scale, ...FULL });
      let total = 0;
      for (let i = 1; i < density.length; ++i) {
        total += Math.abs((density[i] ?? 0) - (density[i - 1] ?? 0));
      }
      return total;
    };

    // when
    const small = roughness(8);
    const large = roughness(80);

    // then
    expect(large).toBeLessThan(small);
  });

  it('turns the woods with a rotation', () => {
    // given
    const options = { scaleX: 60, scaleY: 6, ...FULL };
    const horizontalChange = (rotation: number) => {
      const { density } = forest({ ...options, rotation });
      let total = 0;
      for (let y = 0; y < 60; ++y) {
        for (let x = 1; x < 80; ++x) {
          total += Math.abs(
            (density[y * 80 + x] ?? 0) - (density[y * 80 + x - 1] ?? 0),
          );
        }
      }
      return total;
    };

    // when
    const along = horizontalChange(0);
    const across = horizontalChange(90);

    // then
    expect(along).toBeLessThan(across / 2);
  });

  it('uses the injected noise', () => {
    // given
    const noise = () => 1;
    const options = { noise, minDensity: 0, maxDensity: 1 };

    // when
    const { grid } = forest(options);

    // then
    expect(count(grid, Tile.Grass)).toBe(0);
  });

  it('gives the injected noise the positions of tile centers in noise units', () => {
    // given
    const seen: [number, number][] = [];
    const noise = (x: number, y: number) => {
      seen.push([x, y]);
      return 0;
    };
    const options = { width: 2, height: 2, scaleX: 10, scaleY: 5, noise };

    // when
    forest(options);

    // then
    expect(seen).toEqual([
      [0.05, 0.1],
      [0.15, 0.1],
      [0.05, 0.3],
      [0.15, 0.3],
    ]);
  });

  it('applies the rotation to the injected noise', () => {
    // given
    const seen: [number, number][] = [];
    const noise = (x: number, y: number) => {
      seen.push([x, y]);
      return 0;
    };
    const options = {
      width: 1,
      height: 1,
      scaleX: 1,
      scaleY: 1,
      rotation: 90,
      noise,
    };

    // when
    forest(options);

    // then
    expect(seen[0]?.[0]).toBeCloseTo(0.5);
    expect(seen[0]?.[1]).toBeCloseTo(-0.5);
  });

  it('clamps injected noise that strays out of range', () => {
    // given
    const noise = () => 50;
    const options = { noise, ...FULL };

    // when
    const { density } = forest(options);

    // then
    expect(density.every((chance) => chance === 1)).toBe(true);
  });

  it('ignores the octaves of the built-in noise when noise is injected', () => {
    // given
    const noise = () => 0.3;

    // when
    const a = forest({ noise, octaves: 1 });
    const b = forest({ noise, octaves: 6, persistence: 0.9, lacunarity: 3 });

    // then
    expect(a.grid.toString()).toBe(b.grid.toString());
  });

  it('adds finer detail with more octaves', () => {
    // given
    const roughness = (octaves: number) => {
      const { density } = forest({
        octaves,
        persistence: 1,
        lacunarity: 2,
        ...FULL,
      });
      let total = 0;
      for (let i = 1; i < density.length; ++i) {
        total += Math.abs((density[i] ?? 0) - (density[i - 1] ?? 0));
      }
      return total;
    };

    // when
    const smooth = roughness(1);
    const detailed = roughness(4);

    // then
    expect(detailed).toBeGreaterThan(smooth);
  });

  it('does not require a random source', () => {
    // given
    const options = { width: 10, height: 10 };

    // when
    const { grid } = generateForest(options);

    // then
    expect(grid.width).toBe(10);
  });

  it.each([
    ['width', { width: 0 }],
    ['height', { height: 2.5 }],
    ['minDensity', { minDensity: -0.1 }],
    ['maxDensity', { maxDensity: 1.5 }],
    ['scaleX', { scaleX: 0 }],
    ['scaleY', { scaleY: -1 }],
    ['rotation', { rotation: Number.NaN }],
    ['octaves', { octaves: 0 }],
    ['persistence', { persistence: 2 }],
    ['lacunarity', { lacunarity: 0 }],
    ['groundTile', { groundTile: 99 as Tile }],
    ['treeTile', { treeTile: -1 as Tile }],
  ])('throws a RangeError for an invalid %s', (name, options) => {
    // given
    const generate = () => forest(options);

    // when / then
    expect(generate).toThrow(RangeError);
    expect(generate).toThrow(name);
  });
});
