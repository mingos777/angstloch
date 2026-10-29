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
import { digFishbone } from './dig-fishbone';
import type { DigFishboneOptions } from './dig-fishbone-options';
import type { MinePassage } from '../veins/mine-passage';

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

describe('digFishbone', () => {
  it('digs the same mine from the same seed', () => {
    // given
    const make = () =>
      pipeline(base, [digFishbone()], { random: mulberry32(5) });

    // when
    const first = make();
    const second = make();

    // then
    expect(first.grid.toString()).toBe(second.grid.toString());
    expect(first.passages).toEqual(second.passages);
  });

  it('reaches the density it asks for', () => {
    // given
    const steps = [digFishbone({ density: 0.2 })] as const;

    // when
    const { grid } = pipeline(base, steps, { random: mulberry32(1) });

    // then
    expect(floorTiles(grid).length / (80 * 50)).toBeGreaterThanOrEqual(0.2);
  });

  it('keeps the ring around the map as wall', () => {
    // given
    const steps = [digFishbone({ density: 0.3 })] as const;

    // when
    const { grid } = pipeline(base, steps, { random: mulberry32(2) });

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
          pipeline(base, [digFishbone({ loops: 0.5 })], {
            random: mulberry32(seed),
          }).grid,
        ).length,
    );

    // then
    expect(pieces).toEqual(seeds.map(() => 1));
  });

  it('starts with the main shaft and lists the adits after it', () => {
    // given
    const steps = [digFishbone()] as const;

    // when
    const { passages } = pipeline(base, steps, { random: mulberry32(1) });

    // then
    expect(passages[0]?.kind).toBe('shaft');
    expect(passages.slice(1).every(({ kind }) => kind === 'adit')).toBe(true);
    expect(passages.length).toBeGreaterThan(1);
  });

  it('digs in a smaller area and leaves the rest of the map alone', () => {
    // given
    const steps = [
      digFishbone({
        area: { width: { min: 30, max: 30 }, height: { min: 20, max: 20 } },
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
    expect(Math.max(...ys) - Math.min(...ys)).toBeLessThan(20);
    for (const { tiles: along } of passages) {
      for (const { x, y } of along) {
        expect(grid.get(x, y)).toBe(Tile.Floor);
      }
    }
  });

  it('digs a mine in each of two areas, apart from each other', () => {
    // given
    const steps = [
      digFishbone({
        area: { width: { min: 25, max: 25 }, height: { min: 20, max: 20 } },
        count: { min: 2, max: 2 },
        density: 0.2,
      }),
    ] as const;

    // when
    const { grid, passages } = pipeline(base, steps, {
      random: mulberry32(4),
    });

    // then
    expect(findCaveRegions(grid)).toHaveLength(2);
    expect(passages.filter(({ kind }) => kind === 'shaft')).toHaveLength(2);
  });

  it('digs nothing with a count of 0', () => {
    // given
    const steps = [digFishbone({ count: { min: 0, max: 0 } })] as const;

    // when
    const { grid, passages } = pipeline(base, steps, { random: mulberry32(1) });

    // then
    expect(floorTiles(grid)).toEqual([]);
    expect(passages).toEqual([]);
  });

  it('appends to the passages of an earlier step', () => {
    // given
    const steps = [earlier, digFishbone()] as const;

    // when
    const { passages } = pipeline(base, steps, { random: mulberry32(1) });

    // then
    expect(passages[0]).toEqual({
      kind: 'vein',
      tiles: [{ x: 0, y: 0 }],
      width: 1,
    });
    expect(passages[1]?.kind).toBe('shaft');
  });

  it('continues the lanes of the noise after the earlier passages', () => {
    // given
    const alone = pipeline(base, [digFishbone()], { random: mulberry32(1) });

    // when
    const after = pipeline(base, [earlier, digFishbone()], {
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
    const { grid } = pipeline(base, [wall, digFishbone({ density: 0.3 })], {
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
    const run = () => pipeline(grass, [digFishbone()]);

    // then
    expect(run).toThrow(/out of rock.*Tile\.Wall/);
  });

  it('refuses an area larger than the map', () => {
    // given
    const steps = [digFishbone({ area: { width: { min: 5, max: 81 } } })];

    // when
    const run = () => pipeline(base, steps);

    // then
    expect(run).toThrow(RangeError);
  });

  it('throws a RangeError for a bad option at once', () => {
    // given
    const bad = [
      { density: 2 },
      { angle: Number.NaN },
      { branchAngle: { min: 45, max: 200 } },
      { aditLength: { min: 0, max: 5 } },
      { count: { min: -1, max: 1 } },
    ];

    // when
    const makers = bad.map((options) => () => digFishbone(options));

    // then
    for (const make of makers) {
      expect(make).toThrow(RangeError);
    }
  });
});

function floorShare(grid: Grid): number {
  return (grid.toString().split('.').length - 1) / (grid.width * grid.height);
}

/** Counts the walls that the floor shuts in, which are the ones that a loop of tunnels encloses. */
function countEnclosedWalls(grid: Grid): number {
  const reached = new Set<number>();
  const stack = [{ x: 0, y: 0 }];
  while (stack.length > 0) {
    const tile = stack.pop();
    if (!tile) {
      break;
    }
    const key = tile.y * grid.width + tile.x;
    if (!grid.inBounds(tile.x, tile.y) || reached.has(key)) {
      continue;
    }
    if (grid.get(tile.x, tile.y) !== Tile.Wall) {
      continue;
    }
    reached.add(key);
    for (let dy = -1; dy <= 1; ++dy) {
      for (let dx = -1; dx <= 1; ++dx) {
        stack.push({ x: tile.x + dx, y: tile.y + dy });
      }
    }
  }
  let walls = 0;
  for (let y = 0; y < grid.height; ++y) {
    for (let x = 0; x < grid.width; ++x) {
      walls += grid.get(x, y) === Tile.Wall ? 1 : 0;
    }
  }
  return walls - reached.size;
}

/** Digs a fishbone alone, on a map of rock 80 by 50 unless told otherwise. */
function dig({
  width = 80,
  height = 50,
  random,
  ...options
}: DigFishboneOptions & {
  width?: number;
  height?: number;
  random?: Random;
} = {}) {
  return pipeline(
    emptyMap({ width, height, tile: Tile.Wall }),
    [digFishbone(options)],
    {
      random,
    },
  );
}

describe('digFishbone shaft and adits', () => {
  it('digs tunnels until the density is reached', () => {
    // given
    const options = { density: 0.2, random: mulberry32(4) };

    // when
    const { grid } = dig(options);

    // then
    expect(floorShare(grid)).toBeGreaterThanOrEqual(0.2);
    expect(floorShare(grid)).toBeLessThan(0.25);
  });

  it('digs more with a higher density', () => {
    // given
    const make = (density: number) => dig({ density, random: mulberry32(4) });

    // when
    const sparse = make(0.1);
    const dense = make(0.3);

    // then
    expect(floorShare(dense.grid)).toBeGreaterThan(floorShare(sparse.grid));
  });

  it('digs the main shaft only with a density of 0', () => {
    // given
    const options = { density: 0, random: mulberry32(1) };

    // when
    const { passages } = dig(options);

    // then
    expect(passages).toHaveLength(1);
    expect(passages[0]?.kind).toBe('shaft');
  });

  it('stops short when the map has no room for the density', () => {
    // given
    const options = {
      width: 20,
      height: 20,
      density: 1,
      random: mulberry32(1),
    };

    // when
    const { grid } = dig(options);

    // then
    expect(floorShare(grid)).toBeLessThan(1);
  });

  it('runs a straight main shaft along a row at an angle of 0', () => {
    // given
    const options = {
      angle: 0,
      shaftWindiness: 0,
      density: 0,
      random: mulberry32(1),
    };

    // when
    const { passages } = dig(options);

    // then
    const rows = new Set(passages[0]?.tiles.map((tile) => tile.y));
    expect(rows.size).toBe(1);
  });

  it('runs a straight main shaft along a column at an angle of 90', () => {
    // given
    const options = {
      angle: 90,
      shaftWindiness: 0,
      density: 0,
      random: mulberry32(1),
    };

    // when
    const { passages } = dig(options);

    // then
    const columns = new Set(passages[0]?.tiles.map((tile) => tile.x));
    expect(columns.size).toBe(1);
  });

  it('digs the main shaft as wide as the shaft width says', () => {
    // given
    const options = {
      angle: 0,
      shaftWindiness: 0,
      shaftWidth: { min: 3, max: 3 },
      density: 0,
      random: mulberry32(1),
    };

    // when
    const { grid, passages } = dig(options);

    // then
    const middle = passages[0]?.tiles[20];
    let floors = 0;
    for (let y = 0; y < grid.height; ++y) {
      floors += grid.get(middle?.x ?? 0, y) === Tile.Floor ? 1 : 0;
    }
    expect(passages[0]?.width).toBe(3);
    expect(floors).toBe(3);
  });

  it('winds the main shaft more with a higher windiness', () => {
    // given
    const make = (shaftWindiness: number) =>
      dig({
        angle: 0,
        shaftWindiness,
        density: 0,
        random: mulberry32(2),
      }).passages[0]?.tiles;

    // when
    const straight = make(0);
    const windy = make(1);

    // then
    expect(new Set(straight?.map((tile) => tile.y)).size).toBe(1);
    expect(new Set(windy?.map((tile) => tile.y)).size).toBeGreaterThan(3);
  });

  it('keeps every adit within the length range, which counts along its line', () => {
    // given
    const options = {
      aditLength: { min: 10, max: 15 },
      random: mulberry32(2),
    };

    // when
    const { passages } = dig(options);

    // then
    const adits = passages.filter((passage) => passage.kind === 'adit');
    expect(adits.length).toBeGreaterThan(0);
    for (const { tiles } of adits) {
      expect(tiles.length).toBeGreaterThanOrEqual(10);
      expect(tiles.length).toBeLessThanOrEqual(23);
    }
  });

  it('digs the adits with a width from the adit width range', () => {
    // given
    const options = {
      aditWidth: { min: 1, max: 1 },
      random: mulberry32(2),
    };

    // when
    const { passages } = dig(options);

    // then
    const adits = passages.filter((passage) => passage.kind === 'adit');
    expect(adits.every((adit) => adit.width === 1)).toBe(true);
  });

  it('digs floor along every tunnel', () => {
    // given
    const options = { random: mulberry32(6) };

    // when
    const { grid, passages } = dig(options);

    // then
    for (const { tiles } of passages) {
      for (const tile of tiles) {
        const inside =
          tile.x >= 1 &&
          tile.y >= 1 &&
          tile.x < grid.width - 1 &&
          tile.y < grid.height - 1;
        expect(!inside || grid.get(tile.x, tile.y) === Tile.Floor).toBe(true);
      }
    }
  });

  it('ends adits in dead ends, with no loops, by default', () => {
    // given
    const seeds = [1, 2, 3, 4, 5];

    // when
    const mines = seeds.map((seed) => dig({ random: mulberry32(seed) }));

    // then
    for (const { grid } of mines) {
      expect(countEnclosedWalls(grid)).toBe(0);
    }
  });

  it('makes no loops when a winding shaft curves back towards its adits', () => {
    // given
    const options = {
      width: 80,
      height: 50,
      angle: 111,
      shaftWindiness: 0.75,
      aditWindiness: 0,
      random: mulberry32(3),
    };

    // when
    const { grid } = dig(options);

    // then
    expect(countEnclosedWalls(grid)).toBe(0);
  });

  it('keeps a shaft that winds off the map in one piece', () => {
    // given
    const seeds = Array.from({ length: 20 }, (_, i) => i + 1);

    // when
    const mines = seeds.map((seed) =>
      dig({
        width: 120,
        height: 20,
        angle: 0,
        shaftWindiness: 1,
        random: mulberry32(seed),
      }),
    );

    // then
    for (const { grid } of mines) {
      expect(findCaveRegions(grid)).toHaveLength(1);
    }
  });

  it('makes loops when adits break through into other tunnels', () => {
    // given
    const seeds = [1, 2, 3, 4, 5];

    // when
    const mines = seeds.map((seed) =>
      dig({ loops: 1, random: mulberry32(seed) }),
    );

    // then
    const enclosed = mines.map(({ grid }) => countEnclosedWalls(grid));
    expect(enclosed.every((count) => count > 0)).toBe(true);
  });

  it('digs a mine on a tiny map without failing', () => {
    // given
    const options = { width: 3, height: 3, random: mulberry32(1) };

    // when
    const { grid } = dig(options);

    // then
    expect(grid.width).toBe(3);
  });

  it.each([
    ['angle', { angle: Number.NaN }],
    ['density', { density: 1.5 }],
    ['shaftWindiness', { shaftWindiness: -0.1 }],
    ['aditWindiness', { aditWindiness: 2 }],
    ['loops', { loops: 1.1 }],
    ['shaftWidth', { shaftWidth: { min: 0, max: 2 } }],
    ['aditWidth', { aditWidth: { min: 3, max: 2 } }],
    ['aditLength', { aditLength: { min: 1.5, max: 4 } }],
    ['branchAngle', { branchAngle: { min: 10, max: 180 } }],
    ['branchAngle', { branchAngle: { min: 0, max: 90 } }],
  ])('throws a RangeError for an invalid %s', (_name, invalid) => {
    // given
    const options = invalid;

    // when
    const make = () => digFishbone(options);

    // then
    expect(make).toThrow(RangeError);
  });
});
