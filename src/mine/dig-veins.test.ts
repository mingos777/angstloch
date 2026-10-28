import { describe, expect, it } from 'vitest';
import { findCaveRegions } from '../cave/find-cave-regions';
import type { Grid } from '../core/grid';
import { Tile } from '../core/tile';
import { emptyMap } from '../pipeline/empty-map';
import { pipeline } from '../pipeline/pipeline';
import { Reserve } from '../pipeline/reserve';
import { step } from '../pipeline/step';
import { mulberry32 } from '../test-helpers/mulberry32';
import { digFishbone } from './dig-fishbone';
import type { Random } from '../core/random';
import { digVeins } from './dig-veins';
import type { DigVeinsOptions } from './dig-veins-options';

const base = emptyMap({ width: 80, height: 50, tile: Tile.Wall });

function floorShare(grid: Grid): number {
  return (grid.toString().split('.').length - 1) / (grid.width * grid.height);
}

describe('digVeins', () => {
  it('digs the same web from the same seed', () => {
    // given
    const make = () => pipeline(base, [digVeins()], { random: mulberry32(5) });

    // when
    const first = make();
    const second = make();

    // then
    expect(first.grid.toString()).toBe(second.grid.toString());
    expect(first.passages).toEqual(second.passages);
  });

  it('lists nothing but veins', () => {
    // given
    const steps = [digVeins()] as const;

    // when
    const { passages } = pipeline(base, steps, { random: mulberry32(1) });

    // then
    expect(passages.length).toBeGreaterThan(1);
    expect(passages.every(({ kind }) => kind === 'vein')).toBe(true);
  });

  it('reaches the density it asks for', () => {
    // given
    const steps = [digVeins({ density: 0.2 })] as const;

    // when
    const { grid } = pipeline(base, steps, { random: mulberry32(3) });

    // then
    expect(floorShare(grid)).toBeGreaterThanOrEqual(0.2);
    expect(floorShare(grid)).toBeLessThan(0.3);
  });

  it('keeps the ring around the map as wall', () => {
    // given
    const steps = [digVeins({ density: 0.3 })] as const;

    // when
    const { grid } = pipeline(base, steps, { random: mulberry32(2) });

    // then
    for (let x = 0; x < 80; ++x) {
      expect(grid.get(x, 0)).toBe(Tile.Wall);
      expect(grid.get(x, 49)).toBe(Tile.Wall);
    }
    for (let y = 0; y < 50; ++y) {
      expect(grid.get(0, y)).toBe(Tile.Wall);
      expect(grid.get(79, y)).toBe(Tile.Wall);
    }
  });

  it('digs one connected piece, whatever the seed', () => {
    // given
    const seeds = [1, 2, 3, 4, 5, 6];

    // when
    const pieces = seeds.map(
      (seed) =>
        findCaveRegions(
          pipeline(base, [digVeins()], { random: mulberry32(seed) }).grid,
        ).length,
    );

    // then
    expect(pieces).toEqual(seeds.map(() => 1));
  });

  it('digs a web in each of two areas and shifts the veins to the map', () => {
    // given
    const steps = [
      digVeins({
        area: { width: { min: 30, max: 30 }, height: { min: 20, max: 20 } },
        count: { min: 2, max: 2 },
        veinSpacing: 8,
      }),
    ] as const;

    // when
    const { grid, passages } = pipeline(base, steps, {
      random: mulberry32(4),
    });

    // then
    expect(findCaveRegions(grid)).toHaveLength(2);
    for (const { tiles } of passages) {
      for (const { x, y } of tiles) {
        expect(grid.get(x, y)).toBe(Tile.Floor);
      }
    }
  });

  it('adds its veins to the passages of a fishbone before it', () => {
    // given
    const steps = [
      digFishbone({
        area: { width: { min: 30, max: 30 }, height: { min: 20, max: 20 } },
      }),
      digVeins({
        area: { width: { min: 30, max: 30 }, height: { min: 20, max: 20 } },
      }),
    ] as const;

    // when
    const { passages } = pipeline(base, steps, { random: mulberry32(7) });

    // then
    expect(passages[0]?.kind).toBe('shaft');
    expect(passages.at(-1)?.kind).toBe('vein');
  });

  it('never digs through a reserved tile', () => {
    // given
    const wall = step('reserve', {}, (state) => {
      for (let y = 0; y < 50; ++y) {
        state.reserved[y * 80 + 40] = Reserve.Openable;
      }
      return {};
    });

    // when
    const { grid } = pipeline(base, [wall, digVeins({ density: 0.3 })], {
      random: mulberry32(1),
    });

    // then
    for (let y = 0; y < 50; ++y) {
      expect(grid.get(40, y)).toBe(Tile.Wall);
    }
  });

  it('refuses a map that does not start as wall', () => {
    // given
    const floor = emptyMap({ width: 80, height: 50, tile: Tile.Floor });

    // when
    const run = () => pipeline(floor, [digVeins()]);

    // then
    expect(run).toThrow(/out of rock.*Tile\.Wall/);
  });

  it('throws a RangeError for a bad option at once', () => {
    // given
    const bad = [
      { density: -0.1 },
      { veinSpacing: 2 },
      { veinWidth: { min: 0, max: 2 } },
      { veinWindiness: 1.5 },
    ];

    // when
    const makers = bad.map((options) => () => digVeins(options));

    // then
    for (const make of makers) {
      expect(make).toThrow(RangeError);
    }
  });

  it('digs a web on a tiny map without failing', () => {
    // given
    const sizes = [
      [3, 3],
      [5, 30],
      [30, 5],
    ] as const;

    // when
    const runs = sizes.map(
      ([width, height]) =>
        () =>
          pipeline(emptyMap({ width, height, tile: Tile.Wall }), [digVeins()], {
            random: mulberry32(1),
          }),
    );

    // then
    for (const run of runs) {
      expect(run).not.toThrow();
    }
  });
});

/** Digs with `digVeins` alone, on a map of rock 80 by 50 unless told otherwise. */
function dig({
  width = 80,
  height = 50,
  random,
  ...options
}: DigVeinsOptions & {
  width?: number;
  height?: number;
  random?: Random;
} = {}) {
  return pipeline(
    emptyMap({ width, height, tile: Tile.Wall }),
    [digVeins(options)],
    {
      random,
    },
  );
}

describe('digVeins web', () => {
  it('makes different mines from different seeds', () => {
    // given
    const options = {};

    // when
    const first = dig({ ...options, random: mulberry32(1) });
    const second = dig({ ...options, random: mulberry32(2) });

    // then
    expect(first.grid.toString()).not.toBe(second.grid.toString());
  });

  it('makes one connected piece, whatever the settings', () => {
    // given
    const settings = [0, 0.1, 0.2, 0.4].flatMap((density) =>
      [0, 1].map((veinWindiness) => ({ density, veinWindiness })),
    );

    // when
    const mines = settings.map((setting, i) =>
      dig({ ...setting, random: mulberry32(i + 1) }),
    );

    // then
    for (const { grid } of mines) {
      expect(findCaveRegions(grid)).toHaveLength(1);
    }
  });

  it('keeps veins that wind off the map in one piece', () => {
    // given
    const seeds = Array.from({ length: 20 }, (_, i) => i + 1);

    // when
    const mines = seeds.map((seed) =>
      dig({
        width: 60,
        height: 12,
        veinWindiness: 1,
        density: 0.3,
        random: mulberry32(seed),
      }),
    );

    // then
    for (const { grid } of mines) {
      expect(findCaveRegions(grid)).toHaveLength(1);
    }
  });

  it('digs more veins with a higher density', () => {
    // given
    const make = (density: number) => dig({ density, random: mulberry32(4) });

    // when
    const sparse = make(0.1);
    const dense = make(0.25);

    // then
    expect(dense.passages.length).toBeGreaterThan(sparse.passages.length);
    expect(floorShare(dense.grid)).toBeGreaterThan(floorShare(sparse.grid));
  });

  it('digs only the veins that join the junctions with a density of 0', () => {
    // given
    const options = { density: 0, random: mulberry32(1) };

    // when
    const { grid, passages } = dig(options);

    // then
    const junctions = passages.length + 1;
    expect(junctions).toBeGreaterThan(2);
    expect(findCaveRegions(grid)).toHaveLength(1);
  });

  it('stops short when there are no more veins to dig', () => {
    // given
    const options = { density: 1, random: mulberry32(1) };

    // when
    const { grid } = dig(options);

    // then
    expect(floorShare(grid)).toBeLessThan(1);
  });

  it('digs veins as wide as the vein width says', () => {
    // given
    const options = {
      veinWidth: { min: 3, max: 3 },
      random: mulberry32(1),
    };

    // when
    const { passages } = dig(options);

    // then
    expect(passages.every((passage) => passage.width === 3)).toBe(true);
  });

  it('makes fewer, longer veins with a larger spacing', () => {
    // given
    const make = (veinSpacing: number) =>
      dig({
        veinSpacing,
        density: 0,
        random: mulberry32(1),
      });

    // when
    const fine = make(8);
    const coarse = make(30);

    // then
    expect(fine.passages.length).toBeGreaterThan(coarse.passages.length);
  });

  it('makes every vein a path of tiles that touch along edges', () => {
    // given
    const options = { density: 0.25, random: mulberry32(2) };

    // when
    const { passages } = dig(options);

    // then
    for (const { tiles } of passages) {
      for (let i = 1; i < tiles.length; ++i) {
        const before = tiles[i - 1];
        const tile = tiles[i];
        expect(
          Math.abs((tile?.x ?? 0) - (before?.x ?? 0)) +
            Math.abs((tile?.y ?? 0) - (before?.y ?? 0)),
        ).toBe(1);
      }
    }
  });

  it('digs floor along every vein', () => {
    // given
    const options = { random: mulberry32(6) };

    // when
    const { grid, passages } = dig(options);

    // then
    for (const { tiles } of passages) {
      for (const tile of tiles) {
        expect(grid.get(tile.x, tile.y)).toBe(Tile.Floor);
      }
    }
  });

  it('keeps veins close to a straight line when they are not windy', () => {
    // given
    const options = {
      veinWindiness: 0,
      density: 0,
      random: mulberry32(1),
    };

    // when
    const { passages } = dig(options);

    // then
    for (const { tiles } of passages) {
      const first = tiles[0];
      const last = tiles[tiles.length - 1];
      if (!first || !last) {
        continue;
      }
      const length = Math.hypot(last.x - first.x, last.y - first.y);
      for (const tile of tiles) {
        const off =
          length === 0
            ? 0
            : Math.abs(
                (last.x - first.x) * (first.y - tile.y) -
                  (first.x - tile.x) * (last.y - first.y),
              ) / length;
        expect(off).toBeLessThanOrEqual(1.5);
      }
    }
  });

  it('winds the veins away from a straight line when they are windy', () => {
    // given
    const options = {
      veinWindiness: 1,
      density: 0,
      veinSpacing: 30,
      random: mulberry32(1),
    };

    // when
    const { passages } = dig(options);

    // then
    const offsets = passages.flatMap(({ tiles }) => {
      const first = tiles[0];
      const last = tiles[tiles.length - 1];
      if (!first || !last) {
        return [];
      }
      const length = Math.hypot(last.x - first.x, last.y - first.y) || 1;
      return tiles.map(
        (tile) =>
          Math.abs(
            (last.x - first.x) * (first.y - tile.y) -
              (first.x - tile.x) * (last.y - first.y),
          ) / length,
      );
    });
    expect(Math.max(...offsets)).toBeGreaterThan(3);
  });

  it.each([
    ['veinSpacing', { veinSpacing: 2 }],
    ['veinSpacing', { veinSpacing: 10.5 }],
    ['veinWindiness', { veinWindiness: 1.2 }],
    ['veinWidth', { veinWidth: { min: 0, max: 2 } }],
    ['veinWidth', { veinWidth: { min: 3, max: 2 } }],
  ])('throws a RangeError for an invalid %s', (_name, invalid) => {
    // given
    const options = { ...invalid };

    // when
    const generate = () => dig(options);

    // then
    expect(generate).toThrow(RangeError);
  });
});
