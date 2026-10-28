import { describe, expect, it } from 'vitest';
import { findCaveRegions } from '../cave/find-cave-regions';
import type { Grid } from '../core/grid';
import { Tile } from '../core/tile';
import { emptyMap } from '../pipeline/empty-map';
import { pipeline } from '../pipeline/pipeline';
import { Reserve } from '../pipeline/reserve';
import { step } from '../pipeline/step';
import { mulberry32 } from '../test-helpers/mulberry32';
import type { Random } from '../core/random';
import { digRings } from './dig-rings';
import type { DigRingsOptions } from './dig-rings-options';
import type { MinePassage } from './mine-passage';

const base = emptyMap({ width: 80, height: 50, tile: Tile.Wall });

function floorTiles(grid: Grid) {
  const tiles: { x: number; y: number }[] = [];
  for (let y = 0; y < grid.height; ++y) {
    for (let x = 0; x < grid.width; ++x) {
      if (grid.get(x, y) === Tile.Floor) {
        tiles.push({ x, y });
      }
    }
  }
  return tiles;
}

/** A passage that an earlier step left behind. */
const earlier = step<object, { passages: MinePassage[] }>(
  'earlier',
  { adds: ['passages'] },
  () => ({
    passages: [{ kind: 'vein', tiles: [{ x: 0, y: 0 }], width: 1 }],
  }),
);

describe('digRings', () => {
  it('digs the same mine from the same seed', () => {
    // given
    const make = () => pipeline(base, [digRings()], { random: mulberry32(5) });

    // when
    const first = make();
    const second = make();

    // then
    expect(first.grid.toString()).toBe(second.grid.toString());
    expect(first.passages).toEqual(second.passages);
  });

  it('lists the rings first and the spokes after them', () => {
    // given
    const steps = [digRings()] as const;

    // when
    const { passages } = pipeline(base, steps, { random: mulberry32(1) });

    // then
    const order = passages.map(({ kind }) => kind);
    const firstSpoke = order.indexOf('spoke');
    expect(firstSpoke).toBeGreaterThan(0);
    expect(order.slice(0, firstSpoke).every((kind) => kind === 'ring')).toBe(
      true,
    );
    expect(order.slice(firstSpoke).every((kind) => kind === 'spoke')).toBe(
      true,
    );
  });

  it('digs as many rings as the range says', () => {
    // given
    const steps = [digRings({ rings: { min: 3, max: 3 } })] as const;

    // when
    const { passages } = pipeline(base, steps, { random: mulberry32(1) });

    // then
    expect(passages.filter(({ kind }) => kind === 'ring')).toHaveLength(3);
  });

  it('closes every ring on itself', () => {
    // given
    const steps = [digRings()] as const;

    // when
    const { passages } = pipeline(base, steps, { random: mulberry32(2) });

    // then
    for (const { kind, tiles } of passages) {
      if (kind === 'ring') {
        expect(tiles[0]).toEqual(tiles[tiles.length - 1]);
      }
    }
  });

  it('keeps the ring around the map as wall', () => {
    // given
    const steps = [digRings({ ringWidth: { min: 4, max: 4 } })] as const;

    // when
    const { grid } = pipeline(base, steps, { random: mulberry32(3) });

    // then
    for (const { x, y } of floorTiles(grid)) {
      expect(x > 0 && y > 0 && x < 79 && y < 49).toBe(true);
    }
  });

  it('digs one connected piece, whatever the seed', () => {
    // given
    const seeds = [1, 2, 3, 4, 5, 6];

    // when
    const pieces = seeds.map(
      (seed) =>
        findCaveRegions(
          pipeline(base, [digRings()], { random: mulberry32(seed) }).grid,
        ).length,
    );

    // then
    expect(pieces).toEqual(seeds.map(() => 1));
  });

  it('fits the rings round the middle of a smaller area', () => {
    // given
    const steps = [
      digRings({
        area: { width: { min: 30, max: 30 }, height: { min: 24, max: 24 } },
        ringWobble: 0,
      }),
    ] as const;

    // when
    const { grid, passages } = pipeline(base, steps, {
      random: mulberry32(3),
    });

    // then
    const tiles = floorTiles(grid);
    const xs = tiles.map(({ x }) => x);
    const ys = tiles.map(({ y }) => y);
    expect(Math.max(...xs) - Math.min(...xs)).toBeLessThan(30);
    expect(Math.max(...ys) - Math.min(...ys)).toBeLessThan(24);
    for (const { tiles: along } of passages) {
      for (const { x, y } of along) {
        expect(grid.get(x, y)).toBe(Tile.Floor);
      }
    }
  });

  it('digs rings in each of two areas, apart from each other', () => {
    // given
    const steps = [
      digRings({
        area: { width: { min: 30, max: 30 }, height: { min: 30, max: 30 } },
        count: { min: 2, max: 2 },
      }),
    ] as const;

    // when
    const { grid } = pipeline(base, steps, { random: mulberry32(4) });

    // then
    expect(findCaveRegions(grid)).toHaveLength(2);
  });

  it('digs nothing with a count of 0', () => {
    // given
    const steps = [digRings({ count: { min: 0, max: 0 } })] as const;

    // when
    const { grid, passages } = pipeline(base, steps, { random: mulberry32(1) });

    // then
    expect(floorTiles(grid)).toEqual([]);
    expect(passages).toEqual([]);
  });

  it('appends to the passages of an earlier step', () => {
    // given
    const steps = [earlier, digRings()] as const;

    // when
    const { passages } = pipeline(base, steps, { random: mulberry32(1) });

    // then
    expect(passages[0]?.kind).toBe('vein');
    expect(passages[1]?.kind).toBe('ring');
  });

  it('continues the lanes of the noise after the earlier passages', () => {
    // given
    const alone = pipeline(base, [digRings()], { random: mulberry32(1) });

    // when
    const after = pipeline(base, [earlier, digRings()], {
      random: mulberry32(1),
    });

    // then
    expect(after.grid.toString()).not.toBe(alone.grid.toString());
  });

  it('never digs through a reserved tile', () => {
    // given
    const wall = step('reserve', {}, (state) => {
      for (let y = 0; y < 50; ++y) {
        state.reserved[y * 80 + 40] = Reserve.Solid;
      }
      return {};
    });

    // when
    const { grid } = pipeline(base, [wall, digRings()], {
      random: mulberry32(1),
    });

    // then
    for (let y = 0; y < 50; ++y) {
      expect(grid.get(40, y)).toBe(Tile.Wall);
    }
  });

  it('refuses a map that does not start as wall', () => {
    // given
    const grass = emptyMap({ width: 80, height: 50, tile: Tile.Grass });

    // when
    const run = () => pipeline(grass, [digRings()]);

    // then
    expect(run).toThrow(/out of rock.*Tile\.Wall/);
  });

  it('throws a RangeError for a bad option at once', () => {
    // given
    const bad = [
      { density: 2 },
      { ringShape: 'square' as 'oval' },
      { ringWidth: { min: 0, max: 2 } },
      { spokes: { min: -1, max: 2 } },
      { count: { min: -1, max: 1 } },
    ];

    // when
    const makers = bad.map((options) => () => digRings(options));

    // then
    for (const make of makers) {
      expect(make).toThrow(RangeError);
    }
  });
});

const kinds = <T extends { kind: string }>(passages: T[], kind: string) =>
  passages.filter((passage) => passage.kind === kind);

/** Digs with `digRings` alone, on a map of rock 80 by 50 unless told otherwise. */
function dig({
  width = 80,
  height = 50,
  random,
  ...options
}: DigRingsOptions & {
  width?: number;
  height?: number;
  random?: Random;
} = {}) {
  return pipeline(
    emptyMap({ width, height, tile: Tile.Wall }),
    [digRings(options)],
    {
      random,
    },
  );
}

describe('digRings rings and spokes', () => {
  it('makes different mines from different seeds', () => {
    // given
    const options = {};

    // when
    const first = dig({ ...options, random: mulberry32(1) });
    const second = dig({ ...options, random: mulberry32(2) });

    // then
    expect(first.grid.toString()).not.toBe(second.grid.toString());
  });

  it('digs fewer rings when the map has no room for them', () => {
    // given
    const options = {
      width: 20,
      height: 20,
      rings: { min: 8, max: 8 },
      random: mulberry32(1),
    };

    // when
    const { passages, grid } = dig(options);

    // then
    const rings = kinds(passages, 'ring').length;
    expect(rings).toBeGreaterThanOrEqual(1);
    expect(rings).toBeLessThan(8);
    expect(findCaveRegions(grid)).toHaveLength(1);
  });

  it('digs more rings with a higher density', () => {
    // given
    const make = (density: number) =>
      kinds(dig({ density, random: mulberry32(1) }).passages, 'ring').length;

    // when
    const sparse = make(0.1);
    const dense = make(0.5);

    // then
    expect(dense).toBeGreaterThan(sparse);
  });

  it('ignores the density when it is given a number of rings', () => {
    // given
    const make = (density: number) =>
      dig({
        density,
        rings: { min: 3, max: 3 },
        random: mulberry32(1),
      });

    // when
    const sparse = make(0.1);
    const dense = make(0.9);

    // then
    expect(sparse.grid.toString()).toBe(dense.grid.toString());
  });

  it('leaves rock inside the innermost ring', () => {
    // given
    const options = {
      rings: { min: 2, max: 2 },
      ringWidth: { min: 2, max: 2 },
      random: mulberry32(1),
    };

    // when
    const { grid } = dig(options);

    // then
    expect(grid.get(40, 25)).toBe(Tile.Wall);
  });

  it('digs the rings as wide as the ring width says', () => {
    // given
    const options = {
      ringWidth: { min: 3, max: 3 },
      random: mulberry32(1),
    };

    // when
    const { passages } = dig(options);

    // then
    expect(kinds(passages, 'ring').every((ring) => ring.width === 3)).toBe(
      true,
    );
  });

  it('keeps the rings on an oval at a ring wobble of 0', () => {
    // given
    const options = {
      rings: { min: 1, max: 1 },
      ringWidth: { min: 2, max: 2 },
      ringWobble: 0,
      random: mulberry32(1),
    };

    // when
    const { passages } = dig(options);

    // then
    const [ring] = kinds(passages, 'ring');
    const misses = (ring?.tiles ?? []).map((tile) =>
      Math.abs(
        ((tile.x + 0.5 - 40) / 37) ** 2 + ((tile.y + 0.5 - 25) / 22) ** 2 - 1,
      ),
    );
    expect(Math.max(...misses)).toBeLessThan(0.15);
  });

  it('makes the same mine for the oval shape as for the default', () => {
    // given
    const options = { random: mulberry32(8) };

    // when
    const byDefault = dig(options);
    const oval = dig({
      ...options,
      ringShape: 'oval',
      random: mulberry32(8),
    });

    // then
    expect(oval.grid.toString()).toBe(byDefault.grid.toString());
  });

  it('keeps a ring on a circle with the circle shape', () => {
    // given
    const options: Parameters<typeof dig>[0] = {
      rings: { min: 1, max: 1 },
      ringShape: 'circle',
      ringWidth: { min: 2, max: 2 },
      ringWobble: 0,
      random: mulberry32(1),
    };

    // when
    const { passages } = dig(options);

    // then
    const [ring] = kinds(passages, 'ring');
    const misses = (ring?.tiles ?? []).map((tile) =>
      Math.abs(
        ((tile.x + 0.5 - 40) ** 2 + (tile.y + 0.5 - 25) ** 2) / 22 ** 2 - 1,
      ),
    );
    expect(ring?.tiles.length).toBeGreaterThan(0);
    expect(Math.max(...misses)).toBeLessThan(0.15);
  });

  it('leaves the ends of a wide map as rock with the circle shape', () => {
    // given
    const options: Parameters<typeof dig>[0] = {
      ringShape: 'circle',
      random: mulberry32(2),
    };

    // when
    const { grid } = dig(options);

    // then
    let floorAtTheEnds = 0;
    for (let y = 0; y < grid.height; ++y) {
      for (let x = 0; x < 15; ++x) {
        floorAtTheEnds += grid.get(x, y) === Tile.Floor ? 1 : 0;
        floorAtTheEnds +=
          grid.get(grid.width - 1 - x, y) === Tile.Floor ? 1 : 0;
      }
    }
    expect(floorAtTheEnds).toBe(0);
  });

  it('makes the same mine for both shapes on a square map', () => {
    // given
    const square: Parameters<typeof dig>[0] = { width: 60, height: 60 };

    // when
    const oval = dig({ ...square, random: mulberry32(3) });
    const circle = dig({
      ...square,
      ringShape: 'circle',
      random: mulberry32(3),
    });

    // then
    expect(circle.grid.toString()).toBe(oval.grid.toString());
  });

  it('throws a RangeError for a ring shape that does not exist', () => {
    // given
    const options = { ringShape: 'square' } as unknown as Parameters<
      typeof dig
    >[0];

    // when
    const generate = () => dig(options);

    // then
    expect(generate).toThrow(RangeError);
  });

  it('bends the rings off the oval at a ring wobble of 1', () => {
    // given
    const options = {
      rings: { min: 1, max: 1 },
      ringWidth: { min: 2, max: 2 },
      ringWobble: 1,
      random: mulberry32(1),
    };

    // when
    const { passages } = dig(options);

    // then
    const [ring] = kinds(passages, 'ring');
    const misses = (ring?.tiles ?? []).map((tile) =>
      Math.abs(
        ((tile.x + 0.5 - 40) / 37) ** 2 + ((tile.y + 0.5 - 25) / 22) ** 2 - 1,
      ),
    );
    expect(Math.max(...misses)).toBeGreaterThan(0.2);
  });

  it('joins every ring to the next with as many spokes as the range says', () => {
    // given
    const options = {
      rings: { min: 3, max: 3 },
      spokes: { min: 3, max: 3 },
      random: mulberry32(1),
    };

    // when
    const { passages } = dig(options);

    // then
    expect(kinds(passages, 'spoke')).toHaveLength(6);
  });

  it('digs a spoke at least between every two rings', () => {
    // given
    const options = {
      rings: { min: 4, max: 4 },
      spokes: { min: 0, max: 0 },
      random: mulberry32(1),
    };

    // when
    const { passages, grid } = dig(options);

    // then
    expect(kinds(passages, 'spoke')).toHaveLength(3);
    expect(findCaveRegions(grid)).toHaveLength(1);
  });

  it('digs the spokes as wide as the vein width says', () => {
    // given
    const options = {
      veinWidth: { min: 1, max: 1 },
      random: mulberry32(1),
    };

    // when
    const { passages } = dig(options);

    // then
    const spokes = kinds(passages, 'spoke');
    expect(spokes.length).toBeGreaterThan(0);
    expect(spokes.every((spoke) => spoke.width === 1)).toBe(true);
  });

  it('makes one connected piece, whatever the settings', () => {
    // given
    const settings = Array.from({ length: 40 }, (_, i) => ({
      density: 0.05 + (i % 6) / 6,
      ringWobble: (i % 3) / 2,
      spokes: { min: 0, max: 1 + (i % 4) },
      minExits: i % 3,
    }));

    // when
    const mines = settings.map((setting, i) =>
      dig({ ...setting, random: mulberry32(i + 1) }),
    );

    // then
    for (const { grid } of mines) {
      expect(findCaveRegions(grid)).toHaveLength(1);
    }
  });

  it('digs no floor on a map too small for a ring', () => {
    // given
    const options = { width: 3, height: 3 };

    // when
    const { grid, passages } = dig(options);

    // then
    expect(passages).toEqual([]);
    expect(grid.toString()).not.toContain('.');
  });

  it('digs a mine on a small or thin map without failing', () => {
    // given
    const sizes = [
      [1, 1],
      [2, 2],
      [8, 8],
      [12, 12],
      [5, 30],
      [30, 5],
    ] as const;

    // when
    const mines = sizes.map(([width, height]) =>
      dig({ width, height, random: mulberry32(1) }),
    );

    // then
    expect(mines).toHaveLength(sizes.length);
  });

  it.each([
    ['rings', { rings: { min: 0, max: 2 } }],
    ['rings', { rings: { min: 3, max: 2 } }],
    ['ringWidth', { ringWidth: { min: 0, max: 2 } }],
    ['ringWobble', { ringWobble: 1.5 }],
    ['spokes', { spokes: { min: -1, max: 2 } }],
    ['spokes', { spokes: { min: 3, max: 2 } }],
  ])('throws a RangeError for an invalid %s', (_name, invalid) => {
    // given
    const options = { ...invalid };

    // when
    const generate = () => dig(options);

    // then
    expect(generate).toThrow(RangeError);
  });
});
