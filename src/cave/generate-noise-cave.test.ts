import { describe, expect, it } from 'vitest';
import { countAsymmetry } from '../test-helpers/count-asymmetry';
import { generateNoiseCave } from './generate-noise-cave';
import type { Grid } from '../core/grid';
import { mulberry32 } from '../test-helpers/mulberry32';
import type { NoiseCaveOptions } from './noise-cave-options';
import { Tile } from '../core/tile';

const BASE = { width: 60, height: 40, connect: 'none' } as const;

function cave(options: Partial<NoiseCaveOptions> = {}, seed = 1) {
  return generateNoiseCave({ ...BASE, random: mulberry32(seed), ...options });
}

function count(grid: Grid, tile: Tile) {
  let total = 0;
  for (let y = 0; y < grid.height; ++y) {
    for (let x = 0; x < grid.width; ++x) {
      if (grid.get(x, y) === tile) {
        ++total;
      }
    }
  }
  return total;
}

describe('generateNoiseCave', () => {
  it('returns a grid of the requested size with walls and floors', () => {
    // given
    const options = { width: 50, height: 30 };

    // when
    const { grid } = cave(options);

    // then
    expect(grid.width).toBe(50);
    expect(grid.height).toBe(30);
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

  it.each([
    { width: 0, height: 10 },
    { width: 10, height: -1 },
    { width: 10.5, height: 10 },
  ])('throws a RangeError for the size $width x $height', (size) => {
    // given
    const options = { ...size };

    // when
    const make = () => generateNoiseCave(options);

    // then
    expect(make).toThrow(RangeError);
  });

  it.each([
    { fill: -0.1 },
    { fill: 1.1 },
    { cornerBias: -1 },
    { cornerBias: 2.5 },
    { iterations: -1 },
    { iterations: 1.5 },
    { scaleX: 0 },
    { scaleY: -3 },
    { octaves: 0 },
    { persistence: 2 },
    { minExits: -1 },
  ])('throws a RangeError for %j', (invalid) => {
    // given
    const options = { ...BASE, ...invalid };

    // when
    const make = () => generateNoiseCave(options);

    // then
    expect(make).toThrow(RangeError);
  });
});

describe('generateNoiseCave fill', () => {
  it.each(['blobs', 'veins'] as const)(
    'makes about the share of walls that fill asks for with %s',
    (shape) => {
      // given
      const fill = 0.3;

      // when
      const { grid } = cave({ shape, fill, borderWalls: false });

      // then
      const share = count(grid, Tile.Wall) / (grid.width * grid.height);
      expect(share).toBeCloseTo(fill, 2);
    },
  );

  it('counts only the inner tiles when the border is walled', () => {
    // given
    const options = { fill: 0, width: 20, height: 10 };

    // when
    const { grid } = cave(options);

    // then
    expect(count(grid, Tile.Wall)).toBe(2 * 20 + 2 * 8);
  });

  it('leaves no walls at fill 0 without border walls', () => {
    // given
    const options = { fill: 0, borderWalls: false };

    // when
    const { grid } = cave(options);

    // then
    expect(count(grid, Tile.Wall)).toBe(0);
  });

  it('leaves no floor at fill 1', () => {
    // given
    const options = { fill: 1 };

    // when
    const { grid, regions } = cave(options);

    // then
    expect(count(grid, Tile.Floor)).toBe(0);
    expect(regions).toEqual([]);
  });
});

describe('generateNoiseCave with borderWalls', () => {
  it('keeps the outer ring solid by default', () => {
    // given
    const options = { fill: 0.2 };

    // when
    const { grid } = cave(options);

    // then
    for (let x = 0; x < grid.width; ++x) {
      expect(grid.get(x, 0)).toBe(Tile.Wall);
      expect(grid.get(x, grid.height - 1)).toBe(Tile.Wall);
    }
    for (let y = 0; y < grid.height; ++y) {
      expect(grid.get(0, y)).toBe(Tile.Wall);
      expect(grid.get(grid.width - 1, y)).toBe(Tile.Wall);
    }
  });

  it('lets floor reach the border without it', () => {
    // given
    const options = { fill: 0.2, borderWalls: false, cornerBias: 0 };

    // when
    const { grid } = cave(options);

    // then
    let borderFloor = 0;
    for (let x = 0; x < grid.width; ++x) {
      borderFloor += grid.get(x, 0) === Tile.Floor ? 1 : 0;
    }
    expect(borderFloor).toBeGreaterThan(0);
  });
});

describe('generateNoiseCave with cornerBias', () => {
  /** The share of walls among the tiles within `radius` of any corner. */
  function cornerWallShare(grid: Grid, radius: number) {
    let near = 0;
    let walls = 0;
    for (let y = 0; y < grid.height; ++y) {
      for (let x = 0; x < grid.width; ++x) {
        const corner = Math.hypot(
          Math.min(x, grid.width - 1 - x),
          Math.min(y, grid.height - 1 - y),
        );
        if (corner < radius) {
          ++near;
          walls += grid.get(x, y) === Tile.Wall ? 1 : 0;
        }
      }
    }
    return walls / near;
  }

  it.each(['blobs', 'veins'] as const)(
    'makes wall of the tiles near the corners with %s',
    (shape) => {
      // given
      const options = { shape, borderWalls: false, cornerBias: 0 };
      const plain = cave(options);

      // when
      const biased = cave({ ...options, cornerBias: 12 });

      // then
      expect(cornerWallShare(biased.grid, 3)).toBeGreaterThan(0.95);
      expect(cornerWallShare(plain.grid, 3)).toBeLessThan(0.8);
    },
  );

  it('leaves the cave as plain thresholding at 0', () => {
    // given
    const noise = (x: number) => x;

    // when
    const { grid } = cave({
      noise,
      fill: 0.5,
      borderWalls: false,
      cornerBias: 0,
    });

    // then
    expect(grid.get(59, 0)).toBe(Tile.Floor);
    expect(grid.get(59, 20)).toBe(Tile.Floor);
  });

  it('walls a corner of a noise that is floor there but not a straight edge', () => {
    // given
    const noise = (x: number) => x / 60;

    // when
    const { grid } = cave({
      noise,
      scaleX: 1,
      fill: 0.5,
      borderWalls: false,
      cornerBias: 10,
    });

    // then
    expect(grid.get(59, 0)).toBe(Tile.Wall);
    expect(grid.get(59, 39)).toBe(Tile.Wall);
    expect(grid.get(59, 20)).toBe(Tile.Floor);
  });

  it('reaches as far from the corner as the value says', () => {
    // given
    const noise = (x: number) => x / 60;
    const options = {
      noise,
      scaleX: 1,
      fill: 0.5,
      borderWalls: false,
    };

    // when
    const { grid } = cave({ ...options, cornerBias: 12 });

    // then
    expect(grid.get(59, 11)).toBe(Tile.Floor);
    expect(grid.get(59, 2)).toBe(Tile.Wall);
  });

  it('keeps the share of walls at fill', () => {
    // given
    const options = { fill: 0.4, borderWalls: false, cornerBias: 15 };

    // when
    const { grid } = cave(options);

    // then
    const share = count(grid, Tile.Wall) / (grid.width * grid.height);
    expect(share).toBeCloseTo(0.4, 2);
  });

  it('keeps a symmetric cave symmetric', () => {
    // given
    const options = { layoutSymmetry: 'both', cornerBias: 15 } as const;

    // when
    const { grid } = cave(options);

    // then
    expect(countAsymmetry(grid, 'both')).toBe(0);
  });
});

describe('generateNoiseCave with a custom noise', () => {
  it('makes floor of the high part of the noise for blobs', () => {
    // given
    const noise = (x: number) => x;

    // when
    const { grid } = cave({ noise, fill: 0.5, borderWalls: false });

    // then
    expect(grid.get(5, 20)).toBe(Tile.Wall);
    expect(grid.get(54, 20)).toBe(Tile.Floor);
  });

  it('makes floor around the midpoint of the noise for veins', () => {
    // given
    const noise = (x: number) => (x - 30) / 30;

    // when
    const { grid } = cave({
      noise,
      shape: 'veins',
      scaleX: 1,
      scaleY: 1,
      fill: 0.5,
      borderWalls: false,
    });

    // then
    expect(grid.get(30, 20)).toBe(Tile.Floor);
    expect(grid.get(2, 20)).toBe(Tile.Wall);
    expect(grid.get(57, 20)).toBe(Tile.Wall);
  });

  it('applies the rotation to the noise', () => {
    // given
    const noise = (_x: number, y: number) => y;

    // when
    const { grid } = cave({
      noise,
      rotation: 90,
      fill: 0.5,
      borderWalls: false,
    });

    // then
    expect(grid.get(5, 20)).toBe(Tile.Floor);
    expect(grid.get(54, 20)).toBe(Tile.Wall);
  });

  it('applies the scales to the noise', () => {
    // given
    const seen: number[] = [];
    const noise = (x: number) => {
      seen.push(x);
      return 0;
    };

    // when
    cave({ noise, scaleX: 10, width: 20, height: 5 });

    // then
    expect(Math.max(...seen)).toBeCloseTo(18.5 / 10);
  });
});

describe('generateNoiseCave shapes', () => {
  it('makes other caves for blobs and veins', () => {
    // given
    const blobs = cave({ shape: 'blobs' });

    // when
    const veins = cave({ shape: 'veins' });

    // then
    expect(veins.grid.toString()).not.toBe(blobs.grid.toString());
  });
});

describe('generateNoiseCave with iterations', () => {
  it('smooths the noise', () => {
    // given
    const raw = cave({ iterations: 0, scaleX: 3, scaleY: 3 });

    // when
    const smooth = cave({ iterations: 2, scaleX: 3, scaleY: 3 });

    // then
    expect(smooth.grid.toString()).not.toBe(raw.grid.toString());
  });
});

describe('generateNoiseCave with layoutSymmetry', () => {
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

  it.each(['blobs', 'veins'] as const)(
    'stays symmetric with %s on a map with even sides',
    (shape) => {
      // given
      const options = { width: 60, height: 40, layoutSymmetry: 'both', shape };

      // when
      const { grid } = cave(options as Partial<NoiseCaveOptions>);

      // then
      expect(countAsymmetry(grid, 'both')).toBe(0);
    },
  );

  it('is less symmetric at a chance below 1', () => {
    // given
    const asymmetryAt = (layoutSymmetryChance: number) =>
      countAsymmetry(
        cave({ layoutSymmetry: 'both', layoutSymmetryChance }).grid,
        'both',
      );

    // when
    const loose = asymmetryAt(0.5);

    // then
    expect(loose).toBeGreaterThan(0);
    expect(loose).toBeGreaterThan(asymmetryAt(1));
  });

  it('stays symmetric with tunnels', () => {
    // given
    const options = {
      layoutSymmetry: 'rotational',
      connect: 'tunnel',
      scaleX: 4,
      scaleY: 4,
    } as const;

    // when
    const { grid } = cave(options);

    // then
    expect(countAsymmetry(grid, 'rotational')).toBe(0);
  });
});

describe('generateNoiseCave with connect', () => {
  it.each([1, 2, 3, 4])(
    'joins all caverns into one with tunnels (seed %i)',
    (seed) => {
      // given
      const separate = cave({ scaleX: 5, scaleY: 5 }, seed);

      // when
      const { regions } = cave(
        { connect: 'tunnel', scaleX: 5, scaleY: 5 },
        seed,
      );

      // then
      expect(separate.regions.length).toBeGreaterThan(1);
      expect(regions).toHaveLength(1);
    },
  );

  it('keeps only the largest cavern with largest', () => {
    // given
    const options = { connect: 'largest', scaleX: 5, scaleY: 5 } as const;

    // when
    const { regions } = cave(options);

    // then
    expect(regions).toHaveLength(1);
  });

  it('fills in caverns below minRegionSize', () => {
    // given
    const options = { minRegionSize: 20, scaleX: 5, scaleY: 5 };

    // when
    const { regions } = cave(options);

    // then
    expect(regions.every(({ size }) => size >= 20)).toBe(true);
  });
});

describe('generateNoiseCave with exits', () => {
  it('adds the asked number of exits on the border', () => {
    // given
    const options = { connect: 'tunnel', minExits: 2, maxExits: 2 } as const;

    // when
    const { grid, exits } = cave(options);

    // then
    expect(exits).toHaveLength(2);
    for (const { x, y } of exits) {
      expect(grid.get(x, y)).toBe(Tile.Door);
      expect(
        x === 0 || y === 0 || x === grid.width - 1 || y === grid.height - 1,
      ).toBe(true);
    }
  });
});
