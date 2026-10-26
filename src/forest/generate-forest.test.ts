import { describe, expect, it } from 'vitest';
import type { Grid } from '../core/grid';
import { Tile } from '../core/tile';
import { mulberry32 } from '../test-helpers/mulberry32';
import type { ClearingSpec } from './clearing-spec';
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

  it('lays no roads by default', () => {
    // given
    const options = {};

    // when
    const { grid, roads, junctions, exits } = forest(options);

    // then
    expect([roads, junctions, exits]).toEqual([[], [], []]);
    expect(count(grid, Tile.Road)).toBe(0);
  });

  it('leaves the forest as it was when roads are not asked for', () => {
    // given
    const plain = forest({}, 5);

    // when
    const withoutRoads = forest({ roads: undefined }, 5);

    // then
    expect(withoutRoads.grid.toString()).toBe(plain.grid.toString());
  });

  it('lays a road of road tiles through the forest', () => {
    // given
    const options = { roads: { angle: 0 } };

    // when
    const { grid, roads } = forest(options);

    // then
    expect(roads).toHaveLength(1);
    expect(count(grid, Tile.Road)).toBeGreaterThan(80 * 3 - 10);
  });

  it('puts no trees on the road', () => {
    // given
    const options = { roads: { width: { min: 4, max: 4 } }, maxDensity: 1 };

    // when
    const { grid, roads } = forest(options);

    // then
    for (const { x, y } of roads[0]?.points ?? []) {
      expect(grid.get(x, y)).toBe(Tile.Road);
    }
    expect(count(grid, Tile.Road)).toBeGreaterThan(0);
  });

  it('keeps the trees off the road everywhere, not just on the centerline', () => {
    // given
    const options = {
      roads: { angle: 0, windiness: 0, width: { min: 5, max: 5 } },
      minDensity: 1,
      maxDensity: 1,
    };

    // when
    const { grid } = forest(options);

    // then
    const roadTiles = count(grid, Tile.Road);
    expect(roadTiles + count(grid, Tile.Tree)).toBe(80 * 60);
    expect(roadTiles).toBeGreaterThan(80 * 4);
  });

  it('reports the exits where the road leaves the map', () => {
    // given
    const options = { roads: { angle: 0, windiness: 0 } };

    // when
    const { exits } = forest(options);

    // then
    expect(exits).toHaveLength(2);
    expect(exits.map((exit) => exit.x).sort((a, b) => a - b)).toEqual([0, 79]);
  });

  it('can use another tile for the road', () => {
    // given
    const options = { roads: {}, roadTile: Tile.Floor, groundTile: Tile.Grass };

    // when
    const { grid } = forest(options);

    // then
    expect(count(grid, Tile.Floor)).toBeGreaterThan(0);
    expect(count(grid, Tile.Road)).toBe(0);
  });

  it('rejects invalid road options', () => {
    // given
    const generate = () => forest({ roads: { windiness: 2 } });

    // when / then
    expect(generate).toThrow(RangeError);
  });

  it('rejects an invalid roadTile', () => {
    // given
    const generate = () => forest({ roadTile: 99 as Tile });

    // when / then
    expect(generate).toThrow(RangeError);
    expect(generate).toThrow('roadTile');
  });

  it('reports the junctions of crossings and branches', () => {
    // given
    const options = {
      roads: {
        crossings: { min: 1, max: 1 },
        branches: { min: 3, max: 3 },
      },
    };

    // when
    const { roads, junctions } = forest(options);

    // then
    expect(roads.map((road) => road.kind)).toEqual([
      'road',
      'road',
      'branch',
      'branch',
      'branch',
    ]);
    expect(junctions.length).toBeGreaterThanOrEqual(4);
  });

  it('puts no trees on crossings and branches either', () => {
    // given
    const options = {
      roads: { crossings: { min: 1, max: 1 }, branches: { min: 3, max: 3 } },
      minDensity: 1,
      maxDensity: 1,
    };

    // when
    const { grid, roads } = forest(options);

    // then
    for (const road of roads) {
      for (const { x, y } of road.points) {
        expect(grid.get(x, y)).toBe(Tile.Road);
      }
    }
  });

  it('reports the roads of specs in the order of the list', () => {
    // given
    const options = {
      roads: {
        windiness: 0,
        specs: [
          { origin: { x: 40, y: 30 }, angle: 0 },
          { kind: 'branch' as const, parent: 0, angle: 90, length: 10 },
        ],
      },
    };

    // when
    const { roads, junctions } = forest(options);

    // then
    expect(roads.map((road) => road.kind)).toEqual(['road', 'branch']);
    expect(junctions.length).toBeGreaterThanOrEqual(1);
  });

  it('lays no generated roads when specs are given', () => {
    // given
    const options = {
      roads: { crossings: { min: 3, max: 3 }, specs: [{}] },
    };

    // when
    const { roads } = forest(options);

    // then
    expect(roads).toHaveLength(1);
  });

  it('puts no trees on the roads of specs', () => {
    // given
    const options = {
      roads: { specs: [{}, { parent: 0 }] },
      minDensity: 1,
      maxDensity: 1,
    };

    // when
    const { grid, roads } = forest(options);

    // then
    expect(roads).toHaveLength(2);
    for (const road of roads) {
      for (const { x, y } of road.points) {
        expect(grid.get(x, y)).toBe(Tile.Road);
      }
    }
  });

  it('reports an exit where a road of specs leaves the map', () => {
    // given
    const options = {
      roads: { windiness: 0, specs: [{ origin: { x: 40, y: 30 }, angle: 0 }] },
    };

    // when
    const { exits } = forest(options);

    // then
    expect(exits).toHaveLength(2);
  });

  it('rejects invalid specs', () => {
    // given
    const generate = () => forest({ roads: { specs: [{ parent: 0 }] } });

    // when / then
    expect(generate).toThrow(RangeError);
    expect(generate).toThrow('roads.specs[0].parent');
  });

  it('reports no junctions for a single road', () => {
    // given
    const options = { roads: {} };

    // when
    const { junctions } = forest(options);

    // then
    expect(junctions).toEqual([]);
  });

  describe('clearance', () => {
    const SOLID = { minDensity: 1, maxDensity: 1 };
    const STRAIGHT = {
      angle: 0,
      windiness: 0,
      width: { min: 3, max: 3 },
    };

    it('lets the trees grow up to the road by default', () => {
      // given
      const options = { roads: STRAIGHT, ...SOLID };

      // when
      const { grid, roads } = forest(options);

      // then
      const centerY = roads[0]?.points[0]?.y ?? 0;
      expect(grid.get(40, centerY + 2)).toBe(Tile.Tree);
      expect(grid.get(40, centerY - 2)).toBe(Tile.Tree);
    });

    it('keeps the trees off the tiles within the clearance of the road', () => {
      // given
      const options = { roads: STRAIGHT, clearance: 3, ...SOLID };

      // when
      const { grid, roads } = forest(options);

      // then
      const centerY = roads[0]?.points[0]?.y ?? 0;
      for (const row of [2, 3, 4]) {
        expect(grid.get(40, centerY + row)).toBe(Tile.Grass);
        expect(grid.get(40, centerY - row)).toBe(Tile.Grass);
      }
    });

    it('keeps the full density beyond the clearance', () => {
      // given
      const options = { roads: STRAIGHT, clearance: 3, ...SOLID };

      // when
      const { grid, density, roads } = forest(options);

      // then
      const centerY = roads[0]?.points[0]?.y ?? 0;
      expect(grid.get(40, centerY + 5)).toBe(Tile.Tree);
      expect(grid.get(40, centerY - 5)).toBe(Tile.Tree);
      expect(density[(centerY + 5) * 80 + 40]).toBe(1);
    });

    it('reports a density of 0 where the trees are kept off', () => {
      // given
      const options = { roads: STRAIGHT, clearance: 2, ...SOLID };

      // when
      const { density, roads } = forest(options);

      // then
      const centerY = roads[0]?.points[0]?.y ?? 0;
      expect(density[(centerY + 2) * 80 + 40]).toBe(0);
      expect(density[(centerY + 3) * 80 + 40]).toBe(0);
      expect(density[(centerY + 4) * 80 + 40]).toBe(1);
    });

    it('keeps trees off all eight neighbors of the road with a clearance of 1', () => {
      // given
      const options = {
        roads: {
          crossings: { min: 1, max: 1 },
          branches: { min: 3, max: 3 },
          windiness: 0.8,
        },
        clearance: 1,
        ...SOLID,
      };

      // when
      const { grid, roads } = forest(options);

      // then
      for (const road of roads) {
        for (const { x, y } of road.points) {
          for (let dy = -1; dy <= 1; ++dy) {
            for (let dx = -1; dx <= 1; ++dx) {
              expect(grid.get(x + dx, y + dy)).not.toBe(Tile.Tree);
            }
          }
        }
      }
    });

    it('keeps trees off the tiles diagonally next to a road of any width', () => {
      // given
      const options = {
        roads: { angle: 30, width: { min: 4, max: 4 }, windiness: 0.5 },
        clearance: 1,
        ...SOLID,
      };

      // when
      const { grid } = forest(options);

      // then
      for (let y = 0; y < 60; ++y) {
        for (let x = 0; x < 80; ++x) {
          if (grid.get(x, y) !== Tile.Tree) {
            continue;
          }
          for (let dy = -1; dy <= 1; ++dy) {
            for (let dx = -1; dx <= 1; ++dx) {
              expect(grid.get(x + dx, y + dy)).not.toBe(Tile.Road);
            }
          }
        }
      }
    });

    it('leaves the density of the road tiles alone', () => {
      // given
      const options = {
        roads: STRAIGHT,
        clearance: 3,
        minDensity: 0.7,
        maxDensity: 0.7,
      };

      // when
      const { density, roads } = forest(options);

      // then
      const centerY = roads[0]?.points[0]?.y ?? 0;
      expect(density[centerY * 80 + 40]).toBeCloseTo(0.7);
    });

    it('has no effect without a road', () => {
      // given
      const plain = forest({}, 4);

      // when
      const withClearance = forest({ clearance: 5 }, 4);

      // then
      expect(withClearance.grid.toString()).toBe(plain.grid.toString());
      expect(withClearance.density).toEqual(plain.density);
    });

    it('has no effect with a clearance of 0', () => {
      // given
      const plain = forest({ roads: STRAIGHT }, 4);

      // when
      const zero = forest({ roads: STRAIGHT, clearance: 0 }, 4);

      // then
      expect(zero.grid.toString()).toBe(plain.grid.toString());
    });

    it.each([-1, 1.5, Number.NaN])('rejects a clearance of %s', (clearance) => {
      // given
      const generate = () => forest({ clearance });

      // when / then
      expect(generate).toThrow(RangeError);
      expect(generate).toThrow('clearance');
    });
  });

  describe('falloff', () => {
    const SOLID = { minDensity: 1, maxDensity: 1 };
    const STRAIGHT = {
      angle: 0,
      windiness: 0,
      width: { min: 1, max: 1 },
    };

    it('thickens the trees in equal steps beyond the clearance', () => {
      // given
      const options = { roads: STRAIGHT, clearance: 2, falloff: 3, ...SOLID };

      // when
      const { density, roads } = forest(options);

      // then
      const centerY = roads[0]?.points[0]?.y ?? 0;
      const at = (row: number) => density[(centerY + row) * 80 + 40];
      expect(at(2)).toBe(0);
      expect(at(3)).toBeCloseTo(0.25);
      expect(at(4)).toBeCloseTo(0.5);
      expect(at(5)).toBeCloseTo(0.75);
      expect(at(6)).toBe(1);
    });

    it('scales the density the noise gave', () => {
      // given
      const options = {
        roads: STRAIGHT,
        falloff: 1,
        minDensity: 0.6,
        maxDensity: 0.6,
      };

      // when
      const { density, roads } = forest(options);

      // then
      const centerY = roads[0]?.points[0]?.y ?? 0;
      expect(density[(centerY + 1) * 80 + 40]).toBeCloseTo(0.3);
      expect(density[(centerY + 2) * 80 + 40]).toBeCloseTo(0.6);
    });

    it('works without a clearance', () => {
      // given
      const options = { roads: STRAIGHT, falloff: 1, ...SOLID };

      // when
      const { density, roads } = forest(options);

      // then
      const centerY = roads[0]?.points[0]?.y ?? 0;
      expect(density[(centerY + 1) * 80 + 40]).toBeCloseTo(0.5);
      expect(density[(centerY + 2) * 80 + 40]).toBe(1);
    });

    it('leaves the density of the road tiles alone', () => {
      // given
      const options = { roads: STRAIGHT, falloff: 3, ...SOLID };

      // when
      const { density, roads } = forest(options);

      // then
      const centerY = roads[0]?.points[0]?.y ?? 0;
      expect(density[centerY * 80 + 40]).toBe(1);
    });

    it('has no effect without a road', () => {
      // given
      const plain = forest({}, 4);

      // when
      const withFalloff = forest({ falloff: 5 }, 4);

      // then
      expect(withFalloff.grid.toString()).toBe(plain.grid.toString());
      expect(withFalloff.density).toEqual(plain.density);
    });

    it('has no effect with a falloff of 0', () => {
      // given
      const plain = forest({ roads: STRAIGHT, clearance: 2 }, 4);

      // when
      const zero = forest({ roads: STRAIGHT, clearance: 2, falloff: 0 }, 4);

      // then
      expect(zero.density).toEqual(plain.density);
    });

    it.each([-1, 1.5, Number.NaN])('rejects a falloff of %s', (falloff) => {
      // given
      const generate = () => forest({ falloff });

      // when / then
      expect(generate).toThrow(RangeError);
      expect(generate).toThrow('falloff');
    });
  });

  describe('distance', () => {
    const SOLID = { minDensity: 1, maxDensity: 1 };
    /** A small square map. */
    const DOT = { width: 41, height: 41 };
    const STRAIGHT = { angle: 0, windiness: 0, width: { min: 1, max: 1 } };

    function bare(distance: ForestOptions['distance'], seed = 3) {
      return forest(
        { ...DOT, roads: STRAIGHT, clearance: 3, distance, ...SOLID },
        seed,
      );
    }

    it('measures with chebyshev by default', () => {
      // given
      const explicit = bare('chebyshev');

      // when
      const implicit = forest(
        { ...DOT, roads: STRAIGHT, clearance: 3, ...SOLID },
        3,
      );

      // then
      expect(implicit.density).toEqual(explicit.density);
    });

    it('clears a square strip beside a diagonal road with chebyshev', () => {
      // given
      const options = {
        width: 40,
        height: 40,
        roads: { angle: 45, windiness: 0, width: { min: 1, max: 1 } },
        clearance: 2,
        ...SOLID,
      };

      // when
      const chebyshev = forest({ ...options, distance: 'chebyshev' });
      const manhattan = forest({ ...options, distance: 'manhattan' });

      // then
      expect(count(manhattan.grid, Tile.Tree)).toBeGreaterThan(
        count(chebyshev.grid, Tile.Tree),
      );
    });

    it('clears fewer tiles with euclidean than with chebyshev', () => {
      // given
      const options = {
        width: 40,
        height: 40,
        roads: { angle: 30, windiness: 0.5, width: { min: 1, max: 1 } },
        clearance: 3,
        ...SOLID,
      };

      // when
      const chebyshev = forest({ ...options, distance: 'chebyshev' });
      const euclidean = forest({ ...options, distance: 'euclidean' });

      // then
      expect(count(euclidean.grid, Tile.Tree)).toBeGreaterThan(
        count(chebyshev.grid, Tile.Tree),
      );
    });

    it('measures the falloff with the distance too', () => {
      // given
      const options = {
        roads: { angle: 0, windiness: 0, width: { min: 1, max: 1 } },
        falloff: 1,
        distance: 'manhattan' as const,
        ...SOLID,
      };

      // when
      const { density, roads } = forest(options);

      // then
      const centerY = roads[0]?.points[0]?.y ?? 0;
      expect(density[(centerY + 1) * 80 + 40]).toBeCloseTo(0.5);
      expect(density[(centerY + 2) * 80 + 40]).toBe(1);
    });

    it('rejects an unknown distance', () => {
      // given
      const generate = () =>
        forest({ distance: 'taxicab' as unknown as 'manhattan' });

      // when / then
      expect(generate).toThrow(RangeError);
      expect(generate).toThrow('distance');
    });
  });
});

describe('generateForest clearings', () => {
  const SOLID = { minDensity: 1, maxDensity: 1 };
  const CIRCLE = { x: 40, y: 30, radiusX: { min: 6, max: 6 }, irregularity: 0 };

  it('reports the clearings with their defaults filled in', () => {
    // given
    const clearings = [{ x: 10, y: 12, radiusX: { min: 4, max: 4 } }];

    // when
    const result = forest({ clearings });

    // then
    expect(result.clearings).toEqual([
      {
        x: 10,
        y: 12,
        radiusX: 4,
        radiusY: 4,
        angle: 0,
      },
    ]);
  });

  it('reports no clearings by default', () => {
    // given
    const options = {};

    // when
    const result = forest(options);

    // then
    expect(result.clearings).toEqual([]);
  });

  it('does not change a forest without clearings', () => {
    // given
    const seed = 5;

    // when
    const plain = forest({}, seed);
    const empty = forest({ clearings: [] }, seed);

    // then
    expect(empty.grid.toString()).toBe(plain.grid.toString());
  });

  it('keeps the trees out of the clearing', () => {
    // given
    const options = { ...SOLID, clearings: [CIRCLE] };

    // when
    const { grid } = forest(options);

    // then
    expect(grid.get(40, 30)).toBe(Tile.Grass);
    expect(grid.get(45, 30)).toBe(Tile.Grass);
    expect(grid.get(47, 30)).toBe(Tile.Tree);
  });

  it('sets the density to 0 in the clearing', () => {
    // given
    const options = { ...SOLID, clearings: [CIRCLE] };

    // when
    const { density } = forest(options);

    // then
    expect(density[30 * 80 + 40]).toBe(0);
    expect(density[30 * 80 + 47]).toBe(1);
  });

  it('thins the trees beyond the edge with a falloff', () => {
    // given
    const options = { ...SOLID, falloff: 3, clearings: [CIRCLE] };

    // when
    const { density } = forest(options);

    // then
    expect(density[30 * 80 + 46]).toBe(0);
    expect(density[30 * 80 + 47]).toBeCloseTo(0.25);
    expect(density[30 * 80 + 48]).toBeCloseTo(0.5);
    expect(density[30 * 80 + 50]).toBe(1);
  });

  it('leaves a road through a clearing as a road', () => {
    // given
    const roads = { angle: 0, windiness: 0 };
    const options = { ...SOLID, roads, clearings: [CIRCLE] };

    // when
    const { grid, roads: laid } = forest(options);

    // then
    const [road] = laid;
    const point = road?.points[40] as { x: number; y: number };
    expect(grid.get(point.x, point.y)).toBe(Tile.Road);
  });

  it('makes a different outline for every clearing', () => {
    // given
    const same = { radiusX: { min: 8, max: 8 }, irregularity: 1 };
    const clearings = [
      { x: 20, y: 30, ...same },
      { x: 60, y: 30, ...same },
    ];

    // when
    const { grid } = forest({ ...SOLID, clearings });

    // then
    const outline = (left: number) => {
      let rows = '';
      for (let y = 20; y < 41; ++y) {
        for (let x = left - 10; x < left + 11; ++x) {
          rows += grid.get(x, y) === Tile.Grass ? '.' : '#';
        }
      }
      return rows;
    };
    expect(outline(20)).not.toBe(outline(60));
  });

  it('places a clearing without a center at random', () => {
    // given
    const options = {
      ...SOLID,
      clearings: [{ radiusX: { min: 5, max: 5 }, irregularity: 0 }],
    };

    // when
    const { grid, clearings } = forest(options);

    // then
    const [clearing] = clearings;
    expect(grid.get(clearing?.x ?? -1, clearing?.y ?? -1)).toBe(Tile.Grass);
  });

  it('passes the clearing spacing to the placement', () => {
    // given
    const clearings = Array.from({ length: 3 }, () => ({
      radiusX: { min: 5, max: 5 },
    }));

    // when
    const result = forest({ clearings, clearingSpacing: 12 });

    // then
    const [a, b] = result.clearings;
    expect(
      Math.hypot((a?.x ?? 0) - (b?.x ?? 0), (a?.y ?? 0) - (b?.y ?? 0)),
    ).toBeGreaterThanOrEqual(22);
  });

  it.each([-1, 1.5, Number.NaN])('rejects a clearing spacing of %s', (v) => {
    // given
    const options = { clearingSpacing: v };

    // when
    const generate = () => forest(options);

    // then
    expect(generate).toThrow(RangeError);
  });

  it('places random clearings within the road distance of a road', () => {
    // given
    const roads = { angle: 0, windiness: 0 };
    const clearings = Array.from({ length: 3 }, () => ({
      radiusX: { min: 3, max: 3 },
      roadDistance: { min: 10, max: 14 },
    }));

    // when
    const { clearings: made, roads: laid } = forest({ roads, clearings });

    // then
    const centerline = laid[0]?.points ?? [];
    expect(made).toHaveLength(3);
    for (const { x, y } of made) {
      const away = Math.min(
        ...centerline.map((p) =>
          Math.max(Math.abs(p.x - x), Math.abs(p.y - y)),
        ),
      );
      // the road is 3 tiles wide, so its edge is a tile nearer than its middle
      expect(away).toBeGreaterThanOrEqual(11);
      expect(away).toBeLessThanOrEqual(15);
    }
  });

  it('merges clearings that overlap into one bare patch', () => {
    // given
    const clearings = [
      { x: 30, y: 30, radiusX: { min: 6, max: 6 }, irregularity: 0 },
      { x: 38, y: 30, radiusX: { min: 6, max: 6 }, irregularity: 0 },
    ];

    // when
    const { grid } = forest({ ...SOLID, clearings });

    // then
    for (let x = 24; x <= 44; ++x) {
      expect(grid.get(x, 30)).toBe(Tile.Grass);
    }
    expect(grid.get(46, 30)).toBe(Tile.Tree);
  });

  describe('clearings at branch ends', () => {
    const DEAD_ENDS = {
      specs: [
        { kind: 'road' as const, origin: { x: 10, y: 30 }, angle: 0 },
        { parent: 0, at: 0.3, kind: 'branch' as const, to: { x: 30, y: 10 } },
        { parent: 0, at: 0.6, kind: 'branch' as const, to: { x: 60, y: 10 } },
        { parent: 0, at: 0.8, kind: 'branch' as const, to: { x: 70, y: 50 } },
      ],
    };
    const AT_END = { at: 'branch-end' as const, radiusX: { min: 3, max: 3 } };

    it('centers a clearing on the end of a branch', () => {
      // given
      const clearings = [AT_END];

      // when
      const { clearings: made, roads } = forest({
        roads: DEAD_ENDS,
        clearings,
      });

      // then
      const branch = roads[1];
      expect(made).toHaveLength(1);
      expect(made[0]).toMatchObject(branch?.points.at(-1) ?? {});
    });

    it('takes the branch ends in the order the branches were laid', () => {
      // given
      const clearings = [AT_END, AT_END, AT_END];

      // when
      const { clearings: made, roads } = forest({
        roads: DEAD_ENDS,
        clearings,
      });

      // then
      const ends = roads.slice(1).map((road) => road.points.at(-1));
      expect(made.map(({ x, y }) => ({ x, y }))).toEqual(ends);
    });

    it('leaves out the clearings that find no branch end', () => {
      // given
      const clearings = [AT_END, AT_END, AT_END, AT_END, AT_END];

      // when
      const { clearings: made } = forest({ roads: DEAD_ENDS, clearings });

      // then
      expect(made).toHaveLength(3);
    });

    it('leaves out a clearing when there are no roads', () => {
      // given
      const clearings = [AT_END];

      // when
      const { clearings: made } = forest({ clearings });

      // then
      expect(made).toEqual([]);
    });

    it('skips a branch that runs to the border of the map', () => {
      // given
      const roads = {
        specs: [
          { kind: 'road' as const, origin: { x: 10, y: 30 }, angle: 0 },
          { parent: 0, at: 0.5, kind: 'branch' as const, angle: 90 },
        ],
      };

      // when
      const { clearings: made } = forest({ roads, clearings: [AT_END] });

      // then
      expect(made).toEqual([]);
    });

    it('lists them after the other clearings', () => {
      // given
      const clearings = [AT_END, { x: 5, y: 55, radiusX: { min: 2, max: 2 } }];

      // when
      const { clearings: made } = forest({ roads: DEAD_ENDS, clearings });

      // then
      expect(made[0]).toMatchObject({ x: 5, y: 55 });
      expect(made).toHaveLength(2);
    });

    it('keeps clearings that overlap and merges them', () => {
      // given
      const roads = {
        specs: [
          { kind: 'road' as const, origin: { x: 10, y: 30 }, angle: 0 },
          { parent: 0, at: 0.4, kind: 'branch' as const, to: { x: 40, y: 10 } },
          { parent: 0, at: 0.6, kind: 'branch' as const, to: { x: 41, y: 10 } },
        ],
      };
      const clearings = [AT_END, AT_END];

      // when
      const { clearings: made, grid } = forest({ roads, clearings, ...SOLID });

      // then
      expect(made).toHaveLength(2);
      expect(grid.get(40, 10)).toBe(Tile.Road);
      expect(grid.get(40, 8)).toBe(Tile.Grass);
    });

    it('thins the trees beyond the clearing with the falloff', () => {
      // given
      const options = {
        roads: DEAD_ENDS,
        clearings: [{ ...AT_END, irregularity: 0 }],
        falloff: 3,
        ...SOLID,
      };

      // when
      const { density, roads } = forest(options);

      // then
      const end = roads[1]?.points.at(-1) ?? { x: 0, y: 0 };
      expect(density[end.y * 80 + end.x + 4]).toBeCloseTo(0.25);
    });

    it('gives the same forest for the same seed', () => {
      // given
      const options = {
        roads: DEAD_ENDS,
        clearings: [AT_END, { ...AT_END, radiusX: { min: 2, max: 6 } }],
      };

      // when
      const a = forest(options, 9);
      const b = forest(options, 9);

      // then
      expect(a.grid.toString()).toBe(b.grid.toString());
      expect(a.clearings).toEqual(b.clearings);
    });

    it('rejects an unknown place and a place with a center', () => {
      // given
      const unknown = [{ at: 'nowhere', radiusX: { min: 3, max: 3 } }];
      const centered = [{ ...AT_END, x: 5, y: 5 }];

      // when
      const generateUnknown = () =>
        forest({ clearings: unknown as unknown as ClearingSpec[] });
      const generateCentered = () => forest({ clearings: centered });

      // then
      expect(generateUnknown).toThrow(RangeError);
      expect(generateCentered).toThrow(RangeError);
    });
  });

  describe('paths', () => {
    const STRAIGHT = { angle: 0, windiness: 0 };

    it('leads a path from a road to the center of a clearing', () => {
      // given
      const clearings = [
        { x: 40, y: 10, radiusX: { min: 3, max: 3 }, path: true },
      ];

      // when
      const { roads, grid } = forest({ roads: STRAIGHT, clearings });

      // then
      const path = roads[1];
      expect(path?.kind).toBe('branch');
      expect(path?.points[path.points.length - 1]).toEqual({ x: 40, y: 10 });
      const start = path?.points[0];
      expect(roads[0]?.points).toContainEqual(start);
      expect(grid.get(start?.x ?? -1, start?.y ?? -1)).toBe(Tile.Road);
    });

    it('joins the path to the road at a junction', () => {
      // given
      const clearings = [
        { x: 40, y: 10, radiusX: { min: 3, max: 3 }, path: true },
      ];

      // when
      const { junctions } = forest({ roads: STRAIGHT, clearings });

      // then
      expect(junctions).toHaveLength(1);
    });

    it('makes no path unless asked', () => {
      // given
      const clearings = [{ x: 40, y: 10, radiusX: { min: 3, max: 3 } }];

      // when
      const { roads } = forest({ roads: STRAIGHT, clearings });

      // then
      expect(roads).toHaveLength(1);
    });

    it('leads a path from the border when there are no roads', () => {
      // given
      const clearings = [
        { x: 70, y: 30, radiusX: { min: 3, max: 3 }, path: true },
      ];

      // when
      const { roads, exits, grid } = forest({ clearings });

      // then
      expect(roads).toHaveLength(1);
      expect(roads[0]?.points[0]).toEqual({ x: 79, y: 30 });
      expect(exits).toEqual([{ x: 79, y: 30 }]);
      expect(grid.get(75, 30)).toBe(Tile.Road);
    });

    it('draws the path with the width that was asked for', () => {
      // given
      const path = { width: 3, windiness: 0 };
      const clearings = [{ x: 70, y: 30, radiusX: { min: 3, max: 3 }, path }];

      // when
      const { grid } = forest({ clearings });

      // then
      expect(grid.get(75, 29)).toBe(Tile.Road);
      expect(grid.get(75, 31)).toBe(Tile.Road);
    });

    it('leads a path to a clearing placed at random', () => {
      // given
      const clearings = [{ radiusX: { min: 4, max: 4 }, path: true }];

      // when
      const { roads, clearings: made } = forest({ roads: STRAIGHT, clearings });

      // then
      expect(roads).toHaveLength(2);
      expect(roads[1]?.points[roads[1].points.length - 1]).toEqual({
        x: made[0]?.x,
        y: made[0]?.y,
      });
    });

    it('leads a path to every clearing that asks for one', () => {
      // given
      const clearings = [
        { x: 15, y: 10, radiusX: { min: 3, max: 3 }, path: true },
        { radiusX: { min: 3, max: 3 }, path: true },
        { x: 60, y: 50, radiusX: { min: 3, max: 3 } },
        { x: 65, y: 12, radiusX: { min: 3, max: 3 }, path: { width: 2 } },
      ];

      // when
      const { roads, clearings: made } = forest({ roads: STRAIGHT, clearings });

      // then
      const ends = roads.slice(1).map((road) => road.points.at(-1));
      expect(made).toHaveLength(4);
      expect(ends).toHaveLength(3);
      expect(ends).toContainEqual({ x: 15, y: 10 });
      expect(ends).toContainEqual({ x: 65, y: 12 });
      expect(ends).toContainEqual({ x: made[1]?.x, y: made[1]?.y });
    });

    it('applies the clearance to the path', () => {
      // given
      const clearings = [
        { x: 70, y: 30, radiusX: { min: 3, max: 3 }, path: true },
      ];
      const options = { ...SOLID, clearance: 1, clearings };

      // when
      const { grid } = forest(options);

      // then
      expect(grid.get(75, 29)).toBe(Tile.Grass);
      expect(grid.get(75, 27)).toBe(Tile.Tree);
    });

    it('does not change a forest with roads and clearings but no paths', () => {
      // given
      const clearings = [{ x: 40, y: 10, radiusX: { min: 3, max: 3 } }];

      // when
      const a = forest({ roads: STRAIGHT, clearings }, 6);
      const b = forest({ roads: STRAIGHT, clearings: [...clearings] }, 6);

      // then
      expect(a.grid.toString()).toBe(b.grid.toString());
      expect(a.roads).toHaveLength(1);
    });
  });

  it('is deterministic for the same seed', () => {
    // given
    const options = {
      clearings: [{ x: 30, y: 30, radiusX: { min: 9, max: 9 } }],
    };

    // when
    const a = forest(options, 7);
    const b = forest(options, 7);

    // then
    expect(a.grid.toString()).toBe(b.grid.toString());
  });

  it.each([
    ['x', { x: -1, y: 5, radiusX: { min: 3, max: 3 } }],
    ['x', { x: 1.5, y: 5, radiusX: { min: 3, max: 3 } }],
    ['together', { x: 5, radiusX: { min: 3, max: 3 } }],
    ['together', { y: 5, radiusX: { min: 3, max: 3 } }],
    ['inside', { x: 80, y: 5, radiusX: { min: 3, max: 3 } }],
    ['inside', { x: 5, y: 60, radiusX: { min: 3, max: 3 } }],
    ['radiusX', { x: 5, y: 5, radiusX: { min: 0, max: 0 } }],
    ['radiusX', { x: 5, y: 5, radiusX: { min: 5, max: 3 } }],
    ['radiusX', { x: 5, y: 5, radiusX: { min: 1, max: Number.NaN } }],
    [
      'radiusY',
      {
        x: 5,
        y: 5,
        radiusX: { min: 3, max: 3 },
        radiusY: { min: -1, max: -1 },
      },
    ],
    ['angle', { x: 5, y: 5, radiusX: { min: 3, max: 3 }, angle: Infinity }],
    [
      'irregularity',
      { x: 5, y: 5, radiusX: { min: 3, max: 3 }, irregularity: 1.5 },
    ],
    [
      'roadDistance',
      { radiusX: { min: 3, max: 3 }, roadDistance: { min: -1, max: 5 } },
    ],
    [
      'roadDistance',
      { radiusX: { min: 3, max: 3 }, roadDistance: { min: 9, max: 5 } },
    ],
    [
      'path.width',
      { x: 5, y: 5, radiusX: { min: 3, max: 3 }, path: { width: 0 } },
    ],
    [
      'path.windiness',
      { x: 5, y: 5, radiusX: { min: 3, max: 3 }, path: { windiness: 2 } },
    ],
  ])('rejects an invalid %s', (name, clearing) => {
    // given
    const options = { clearings: [clearing] };

    // when
    const generate = () => forest(options);

    // then
    expect(generate).toThrow(RangeError);
    expect(generate).toThrow(name);
  });
});
