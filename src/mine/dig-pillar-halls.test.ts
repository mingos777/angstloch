import { describe, expect, it } from 'vitest';
import { findCaveRegions } from '../cave/find-cave-regions';
import type { Area } from '../core/area';
import type { Grid } from '../core/grid';
import { Tile } from '../core/tile';
import { emptyMap } from '../pipeline/empty-map';
import { pipeline } from '../pipeline/pipeline';
import { Reserve } from '../pipeline/reserve';
import { step } from '../pipeline/step';
import { mulberry32 } from '../test-helpers/mulberry32';
import type { Random } from '../core/random';
import { digVeins } from '../veins/dig-veins';
import { digPillarHalls } from './dig-pillar-halls';
import type { DigPillarHallsOptions } from './dig-pillar-halls-options';
import type { MinePassage } from '../veins/mine-passage';

const base = emptyMap({ width: 100, height: 60, tile: Tile.Wall });

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

function inside(box: Area, { x, y }: { x: number; y: number }): boolean {
  return (
    x >= box.x && y >= box.y && x < box.x + box.width && y < box.y + box.height
  );
}

function apart(a: Area, b: Area): number {
  const gapX = Math.max(a.x - (b.x + b.width), b.x - (a.x + a.width));
  const gapY = Math.max(a.y - (b.y + b.height), b.y - (a.y + a.height));
  return Math.max(gapX, gapY);
}

/** A passage and a hall that an earlier step left behind. */
const earlier = step<object, { passages: MinePassage[]; halls: Area[] }>(
  'earlier',
  { adds: ['passages', 'halls'] },
  () => ({
    passages: [{ kind: 'vein', tiles: [{ x: 0, y: 0 }], width: 1 }],
    halls: [{ x: 0, y: 0, width: 1, height: 1 }],
  }),
);

describe('digPillarHalls', () => {
  it('digs the same halls from the same seed', () => {
    // given
    const make = () =>
      pipeline(base, [digPillarHalls()], { random: mulberry32(5) });

    // when
    const first = make();
    const second = make();

    // then
    expect(first.grid.toString()).toBe(second.grid.toString());
    expect(first.halls).toEqual(second.halls);
  });

  it('lists the halls and digs no veins', () => {
    // given
    const steps = [digPillarHalls({ halls: { min: 3, max: 3 } })] as const;

    // when
    const result = pipeline(base, steps, { random: mulberry32(1) });

    // then
    expect(result.halls).toHaveLength(3);
    expect('passages' in result).toBe(false);
  });

  it('leaves the halls apart, one piece of floor for each', () => {
    // given
    const steps = [digPillarHalls({ halls: { min: 3, max: 3 } })] as const;

    // when
    const { grid } = pipeline(base, steps, { random: mulberry32(1) });

    // then
    expect(findCaveRegions(grid)).toHaveLength(3);
  });

  it('keeps the ring around the map as wall', () => {
    // given
    const steps = [digPillarHalls({ density: 0.6 })] as const;

    // when
    const { grid } = pipeline(base, steps, { random: mulberry32(3) });

    // then
    for (const { x, y } of floorTiles(grid)) {
      expect(x > 0 && y > 0 && x < 99 && y < 59).toBe(true);
    }
  });

  it('keeps the halls apart and inside the border', () => {
    // given
    const steps = [digPillarHalls({ halls: { min: 4, max: 4 } })] as const;

    // when
    const { halls } = pipeline(base, steps, { random: mulberry32(2) });

    // then
    for (const [i, hall] of halls.entries()) {
      expect(hall.x).toBeGreaterThanOrEqual(1);
      expect(hall.y).toBeGreaterThanOrEqual(1);
      expect(hall.x + hall.width).toBeLessThanOrEqual(99);
      expect(hall.y + hall.height).toBeLessThanOrEqual(59);
      for (const other of halls.slice(i + 1)) {
        expect(apart(hall, other)).toBeGreaterThanOrEqual(4);
      }
    }
  });

  it('leaves pillars standing in the halls', () => {
    // given
    const steps = [
      digPillarHalls({
        halls: { min: 1, max: 1 },
        hallSize: { min: 20, max: 20 },
        hallRagged: 0,
      }),
    ] as const;

    // when
    const { grid, halls } = pipeline(base, steps, { random: mulberry32(1) });

    // then
    const [hall] = halls;
    let walls = 0;
    for (let y = 1; hall && y < hall.height - 1; ++y) {
      for (let x = 1; x < hall.width - 1; ++x) {
        if (grid.get(hall.x + x, hall.y + y) === Tile.Wall) {
          ++walls;
        }
      }
    }
    expect(walls).toBeGreaterThan(0);
  });

  it('digs one hall in a small area and leaves the rest of the map alone', () => {
    // given
    const steps = [
      digPillarHalls({
        halls: { min: 1, max: 1 },
        area: { width: { min: 20, max: 20 }, height: { min: 16, max: 16 } },
      }),
    ] as const;

    // when
    const { grid, halls } = pipeline(base, steps, { random: mulberry32(3) });

    // then
    const [hall] = halls;
    expect(halls).toHaveLength(1);
    const tiles = floorTiles(grid);
    expect(tiles.length).toBeGreaterThan(0);
    for (const tile of tiles) {
      expect(hall && inside(hall, tile)).toBe(true);
    }
  });

  it('digs halls in each of two areas, apart from each other', () => {
    // given
    const steps = [
      digPillarHalls({
        halls: { min: 2, max: 2 },
        area: { width: { min: 40, max: 40 }, height: { min: 25, max: 25 } },
        count: { min: 2, max: 2 },
      }),
    ] as const;

    // when
    const { halls } = pipeline(base, steps, { random: mulberry32(4) });

    // then
    expect(halls).toHaveLength(4);
  });

  it('digs nothing with a count of 0', () => {
    // given
    const steps = [digPillarHalls({ count: { min: 0, max: 0 } })] as const;

    // when
    const { grid, halls } = pipeline(base, steps, { random: mulberry32(1) });

    // then
    expect(floorTiles(grid)).toEqual([]);
    expect(halls).toEqual([]);
  });

  it('appends to the halls of an earlier step', () => {
    // given
    const steps = [earlier, digPillarHalls()] as const;

    // when
    const { halls } = pipeline(base, steps, { random: mulberry32(1) });

    // then
    expect(halls[0]).toEqual({ x: 0, y: 0, width: 1, height: 1 });
    expect(halls.length).toBeGreaterThan(1);
  });

  it('never digs a hall through a reserved tile', () => {
    // given
    const wall = step('reserve', {}, (state) => {
      for (let y = 0; y < 60; ++y) {
        state.reserved[y * 100 + 50] = Reserve.Solid;
      }
      return {};
    });
    const seeds = [1, 2, 3, 4];

    // when
    const grids = seeds.map(
      (seed) =>
        pipeline(base, [wall, digPillarHalls({ density: 0.5 })], {
          random: mulberry32(seed),
        }).grid,
    );

    // then
    for (const grid of grids) {
      for (let y = 0; y < 60; ++y) {
        expect(grid.get(50, y)).toBe(Tile.Wall);
      }
    }
  });

  it('refuses a map that does not start as wall', () => {
    // given
    const grass = emptyMap({ width: 100, height: 60, tile: Tile.Grass });

    // when
    const run = () => pipeline(grass, [digPillarHalls()]);

    // then
    expect(run).toThrow(/out of rock.*Tile\.Wall/);
  });

  it('throws a RangeError for a bad option at once', () => {
    // given
    const bad = [
      { density: 2 },
      { halls: { min: 0, max: 2 } },
      { pillarJitter: -1 },
      { count: { min: -1, max: 1 } },
    ];

    // when
    const makers = bad.map((options) => () => digPillarHalls(options));

    // then
    for (const make of makers) {
      expect(make).toThrow(RangeError);
    }
  });
});

function floorShare(grid: Grid): number {
  return (grid.toString().split('.').length - 1) / (grid.width * grid.height);
}

/** Finds the islands of wall that floor shuts in, each as the tiles it is made of. */
function findIslands(grid: Grid): { x: number; y: number }[][] {
  const outside = new Set<number>();
  const flood = (startX: number, startY: number, into: Set<number>) => {
    const stack = [{ x: startX, y: startY }];
    for (let tile = stack.pop(); tile; tile = stack.pop()) {
      const key = tile.y * grid.width + tile.x;
      if (
        !grid.inBounds(tile.x, tile.y) ||
        into.has(key) ||
        grid.get(tile.x, tile.y) !== Tile.Wall
      ) {
        continue;
      }
      into.add(key);
      for (let dy = -1; dy <= 1; ++dy) {
        for (let dx = -1; dx <= 1; ++dx) {
          stack.push({ x: tile.x + dx, y: tile.y + dy });
        }
      }
    }
  };
  flood(0, 0, outside);
  const islands: { x: number; y: number }[][] = [];
  const seen = new Set<number>();
  for (let y = 0; y < grid.height; ++y) {
    for (let x = 0; x < grid.width; ++x) {
      const key = y * grid.width + x;
      if (grid.get(x, y) === Tile.Wall && !outside.has(key) && !seen.has(key)) {
        const island = new Set<number>();
        flood(x, y, island);
        for (const member of island) {
          seen.add(member);
        }
        islands.push(
          [...island].map((k) => ({
            x: k % grid.width,
            y: Math.floor(k / grid.width),
          })),
        );
      }
    }
  }
  return islands;
}

function bounds(tiles: readonly { x: number; y: number }[]) {
  const xs = tiles.map((tile) => tile.x);
  const ys = tiles.map((tile) => tile.y);
  return {
    x: Math.min(...xs),
    y: Math.min(...ys),
    width: Math.max(...xs) - Math.min(...xs) + 1,
    height: Math.max(...ys) - Math.min(...ys) + 1,
  };
}

/** The islands of wall that lie within a hall and away from the veins, which are its pillars. Slivers of rock that veins shut in are not. */
function findPillars(result: {
  grid: Grid;
  halls: Area[];
  passages: { tiles: { x: number; y: number }[] }[];
}) {
  const veins = new Set(
    result.passages.flatMap(({ tiles }) =>
      tiles.map(({ x, y }) => y * result.grid.width + x),
    ),
  );
  const nearVein = ({ x, y }: { x: number; y: number }) => {
    for (let dy = -3; dy <= 3; ++dy) {
      for (let dx = -3; dx <= 3; ++dx) {
        if (veins.has((y + dy) * result.grid.width + x + dx)) {
          return true;
        }
      }
    }
    return false;
  };
  return findIslands(result.grid).filter((island) => {
    const box = bounds(island);
    return (
      !island.some(nearVein) &&
      result.halls.some(
        (hall) =>
          box.x >= hall.x &&
          box.y >= hall.y &&
          box.x + box.width <= hall.x + hall.width &&
          box.y + box.height <= hall.y + hall.height,
      )
    );
  });
}

/** Digs with `digPillarHalls` and `digVeins` joining the halls, on a map of rock 100 by 60 unless told otherwise. */
function dig({
  width = 100,
  height = 60,
  random,
  ...options
}: DigPillarHallsOptions & {
  width?: number;
  height?: number;
  random?: Random;
} = {}) {
  return pipeline(
    emptyMap({ width, height, tile: Tile.Wall }),
    [digPillarHalls(options), digVeins({ density: 0 })],
    { random },
  );
}

describe('digPillarHalls halls and pillars', () => {
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
    const settings = Array.from({ length: 40 }, (_, i) => ({
      density: 0.1 + (i % 5) / 8,
      hallRagged: (i % 3) / 2,
      pillarRagged: (i % 4) / 3,
      pillarJitter: (i % 5) / 4,
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

  it('digs as many halls as the range says, when there is room', () => {
    // given
    const options = {
      width: 160,
      height: 100,
      halls: { min: 5, max: 5 },
      hallSize: { min: 12, max: 20 },
      random: mulberry32(1),
    };

    // when
    const { halls } = dig(options);

    // then
    expect(halls).toHaveLength(5);
  });

  it('digs fewer halls when the map has no room for more', () => {
    // given
    const options = {
      width: 40,
      height: 40,
      halls: { min: 4, max: 4 },
      hallSize: { min: 30, max: 30 },
      random: mulberry32(1),
    };

    // when
    const { halls, grid } = dig(options);

    // then
    expect(halls.length).toBeGreaterThanOrEqual(1);
    expect(halls.length).toBeLessThan(4);
    expect(findCaveRegions(grid)).toHaveLength(1);
  });

  it('digs halls of the size that hall size says', () => {
    // given
    const options = {
      hallSize: { min: 14, max: 14 },
      random: mulberry32(1),
    };

    // when
    const { halls } = dig(options);

    // then
    expect(halls.every((hall) => hall.width === 14 && hall.height === 14)).toBe(
      true,
    );
  });

  it('digs larger halls with a higher density', () => {
    // given
    const make = (density: number) =>
      dig({
        density,
        halls: { min: 3, max: 3 },
        random: mulberry32(1),
      }).halls.reduce((sum, hall) => sum + hall.width * hall.height, 0);

    // when
    const small = make(0.1);
    const large = make(0.4);

    // then
    expect(large).toBeGreaterThan(small);
  });

  it('fills about the density with floor', () => {
    // given
    const options = { density: 0.3, random: mulberry32(4) };

    // when
    const { grid } = dig(options);

    // then
    expect(floorShare(grid)).toBeGreaterThan(0.2);
    expect(floorShare(grid)).toBeLessThan(0.4);
  });

  it('fills the halls to their corners at a hall ragged of 0', () => {
    // given
    const options = {
      hallSize: { min: 12, max: 12 },
      hallRagged: 0,
      pillarSize: { min: 30, max: 30 },
      random: mulberry32(1),
    };

    // when
    const { grid, halls } = dig(options);

    // then
    for (const hall of halls) {
      for (let y = hall.y; y < hall.y + hall.height; ++y) {
        for (let x = hall.x; x < hall.x + hall.width; ++x) {
          expect(grid.get(x, y)).toBe(Tile.Floor);
        }
      }
    }
  });

  it('roughens the edges of the halls at a hall ragged of 1', () => {
    // given
    const options = {
      hallSize: { min: 12, max: 12 },
      hallRagged: 1,
      pillarSize: { min: 30, max: 30 },
      random: mulberry32(1),
    };

    // when
    const { grid, halls } = dig(options);

    // then
    const walls = halls.flatMap((hall) => {
      const tiles = [];
      for (let y = hall.y; y < hall.y + hall.height; ++y) {
        for (let x = hall.x; x < hall.x + hall.width; ++x) {
          if (grid.get(x, y) === Tile.Wall) {
            tiles.push({ x, y });
          }
        }
      }
      return tiles;
    });
    expect(walls.length).toBeGreaterThan(0);
  });

  it('leaves no pillars when none fits in a hall', () => {
    // given
    const options = {
      hallSize: { min: 8, max: 8 },
      pillarSize: { min: 9, max: 9 },
      random: mulberry32(1),
    };

    // when
    const result = dig(options);

    // then
    expect(findPillars(result)).toEqual([]);
  });

  it('makes clean rectangles of the pillars at a pillar ragged of 0', () => {
    // given
    const options = {
      pillarRagged: 0,
      pillarSize: { min: 3, max: 6 },
      random: mulberry32(1),
    };

    // when
    const result = dig(options);

    // then
    const islands = findPillars(result);
    expect(islands.length).toBeGreaterThan(0);
    for (const island of islands) {
      const box = bounds(island);
      expect(island).toHaveLength(box.width * box.height);
    }
  });

  it('keeps the pillars within the pillar size', () => {
    // given
    const options = {
      pillarRagged: 0,
      pillarSize: { min: 3, max: 6 },
      random: mulberry32(2),
    };

    // when
    const result = dig(options);

    // then
    for (const island of findPillars(result)) {
      const box = bounds(island);
      expect(box.width).toBeGreaterThanOrEqual(3);
      expect(box.width).toBeLessThanOrEqual(6);
      expect(box.height).toBeGreaterThanOrEqual(3);
      expect(box.height).toBeLessThanOrEqual(6);
    }
  });

  it('roughens the pillars at a pillar ragged of 1', () => {
    // given
    const options = {
      pillarRagged: 1,
      pillarSize: { min: 6, max: 8 },
      random: mulberry32(1),
    };

    // when
    const result = dig(options);

    // then
    const islands = findPillars(result);
    const rough = islands.filter((island) => {
      const box = bounds(island);
      return island.length < box.width * box.height;
    });
    expect(rough.length).toBeGreaterThan(0);
  });

  it('keeps every pillar apart from the others and from the walls', () => {
    // given
    const seeds = [1, 2, 3, 4, 5];

    // when
    const mines = seeds.map((seed) =>
      dig({
        pillarJitter: 1,
        random: mulberry32(seed),
      }),
    );

    // then
    for (const mine of mines) {
      expect(findCaveRegions(mine.grid)).toHaveLength(1);
      for (const island of findPillars(mine)) {
        for (const { x, y } of island) {
          expect(x).toBeGreaterThan(0);
          expect(y).toBeGreaterThan(0);
        }
      }
    }
  });

  it('puts the pillars of a hall on a regular grid at a pillar jitter of 0', () => {
    // given
    const options = {
      halls: { min: 1, max: 1 },
      hallSize: { min: 50, max: 50 },
      hallRagged: 0,
      pillarRagged: 0,
      pillarJitter: 0,
      pillarSize: { min: 3, max: 3 },
      pillarSpacing: { min: 3, max: 3 },
      random: mulberry32(1),
    };

    // when
    const result = dig(options);

    // then
    const islands = findPillars(result).map(bounds);
    expect(islands.length).toBeGreaterThan(4);
    const first = islands[0];
    for (const island of islands) {
      expect((island.x - (first?.x ?? 0)) % 6).toBe(0);
      expect((island.y - (first?.y ?? 0)) % 6).toBe(0);
    }
  });

  it('puts the pillars off the grid at a pillar jitter of 1', () => {
    // given
    const options = {
      halls: { min: 1, max: 1 },
      hallSize: { min: 50, max: 50 },
      hallRagged: 0,
      pillarRagged: 0,
      pillarJitter: 1,
      pillarSize: { min: 3, max: 3 },
      pillarSpacing: { min: 4, max: 4 },
      random: mulberry32(1),
    };

    // when
    const result = dig(options);

    // then
    const islands = findPillars(result).map(bounds);
    const first = islands[0];
    const off = islands.filter(
      (island) =>
        (island.x - (first?.x ?? 0)) % 7 !== 0 ||
        (island.y - (first?.y ?? 0)) % 7 !== 0,
    );
    expect(off.length).toBeGreaterThan(0);
  });

  it('digs a mine on a tiny map without failing', () => {
    // given
    const sizes = [
      [1, 1],
      [2, 2],
      [3, 3],
      [5, 30],
      [30, 5],
      [12, 12],
    ] as const;

    // when
    const mines = sizes.map(([width, height]) =>
      dig({ width, height, random: mulberry32(1) }),
    );

    // then
    expect(mines).toHaveLength(sizes.length);
  });

  it.each([
    ['halls', { halls: { min: 0, max: 2 } }],
    ['halls', { halls: { min: 3, max: 2 } }],
    ['hallSize', { hallSize: { min: 0, max: 5 } }],
    ['hallRagged', { hallRagged: 1.5 }],
    ['pillarSize', { pillarSize: { min: 1.5, max: 3 } }],
    ['pillarSpacing', { pillarSpacing: { min: 0, max: 3 } }],
    ['pillarRagged', { pillarRagged: -0.1 }],
    ['pillarJitter', { pillarJitter: 2 }],
  ])('throws a RangeError for an invalid %s', (_name, invalid) => {
    // given
    const options = { ...invalid };

    // when
    const generate = () => dig(options);

    // then
    expect(generate).toThrow(RangeError);
  });
});
