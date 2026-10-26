import { describe, expect, it } from 'vitest';
import { findCaveRegions } from '../cave/find-cave-regions';
import type { Area } from '../core/area';
import type { Grid } from '../core/grid';
import { Tile } from '../core/tile';
import { mulberry32 } from '../test-helpers/mulberry32';
import { generateMine } from './generate-mine';
import type { MineOptions } from './mine-options';

const base: MineOptions = { width: 100, height: 60, layout: 'pillars' };

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

function apart(a: Area, b: Area): number {
  const gapX = Math.max(a.x - (b.x + b.width), b.x - (a.x + a.width));
  const gapY = Math.max(a.y - (b.y + b.height), b.y - (a.y + a.height));
  return Math.max(gapX, gapY);
}

describe('generateMine with the pillars layout', () => {
  it('makes the same mine from the same seed', () => {
    // given
    const make = () => generateMine({ ...base, random: mulberry32(5) });

    // when
    const first = make();
    const second = make();

    // then
    expect(first.grid.toString()).toBe(second.grid.toString());
    expect(first.halls).toEqual(second.halls);
  });

  it('makes different mines from different seeds', () => {
    // given
    const options = base;

    // when
    const first = generateMine({ ...options, random: mulberry32(1) });
    const second = generateMine({ ...options, random: mulberry32(2) });

    // then
    expect(first.grid.toString()).not.toBe(second.grid.toString());
  });

  it('lists the veins that join the halls', () => {
    // given
    const options = {
      ...base,
      halls: { min: 3, max: 3 },
      random: mulberry32(1),
    };

    // when
    const { halls, passages } = generateMine(options);

    // then
    expect(halls).toHaveLength(3);
    expect(passages.length).toBeGreaterThanOrEqual(2);
    expect(passages.every((passage) => passage.kind === 'vein')).toBe(true);
  });

  it('keeps the ring around the map as wall', () => {
    // given
    const options = { ...base, density: 0.6, random: mulberry32(3) };

    // when
    const { grid } = generateMine(options);

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

  it('makes one connected piece, whatever the settings', () => {
    // given
    const settings = Array.from({ length: 40 }, (_, i) => ({
      density: 0.1 + (i % 5) / 8,
      hallRagged: (i % 3) / 2,
      pillarRagged: (i % 4) / 3,
      pillarJitter: (i % 5) / 4,
      minExits: i % 3,
    }));

    // when
    const mines = settings.map((setting, i) =>
      generateMine({ ...base, ...setting, random: mulberry32(i + 1) }),
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
      layout: 'pillars' as const,
      halls: { min: 5, max: 5 },
      hallSize: { min: 12, max: 20 },
      random: mulberry32(1),
    };

    // when
    const { halls } = generateMine(options);

    // then
    expect(halls).toHaveLength(5);
  });

  it('digs fewer halls when the map has no room for more', () => {
    // given
    const options = {
      width: 40,
      height: 40,
      layout: 'pillars' as const,
      halls: { min: 4, max: 4 },
      hallSize: { min: 30, max: 30 },
      random: mulberry32(1),
    };

    // when
    const { halls, grid } = generateMine(options);

    // then
    expect(halls.length).toBeGreaterThanOrEqual(1);
    expect(halls.length).toBeLessThan(4);
    expect(findCaveRegions(grid)).toHaveLength(1);
  });

  it('digs no veins for a single hall', () => {
    // given
    const options = {
      ...base,
      halls: { min: 1, max: 1 },
      random: mulberry32(1),
    };

    // when
    const { halls, passages } = generateMine(options);

    // then
    expect(halls).toHaveLength(1);
    expect(passages).toEqual([]);
  });

  it('keeps the halls apart and inside the border', () => {
    // given
    const options = {
      ...base,
      halls: { min: 4, max: 4 },
      random: mulberry32(2),
    };

    // when
    const { halls } = generateMine(options);

    // then
    for (const [i, hall] of halls.entries()) {
      expect(hall.x).toBeGreaterThanOrEqual(1);
      expect(hall.y).toBeGreaterThanOrEqual(1);
      expect(hall.x + hall.width).toBeLessThanOrEqual(base.width - 1);
      expect(hall.y + hall.height).toBeLessThanOrEqual(base.height - 1);
      for (const other of halls.slice(i + 1)) {
        expect(apart(hall, other)).toBeGreaterThanOrEqual(4);
      }
    }
  });

  it('digs halls of the size that hall size says', () => {
    // given
    const options = {
      ...base,
      hallSize: { min: 14, max: 14 },
      random: mulberry32(1),
    };

    // when
    const { halls } = generateMine(options);

    // then
    expect(halls.every((hall) => hall.width === 14 && hall.height === 14)).toBe(
      true,
    );
  });

  it('digs larger halls with a higher density', () => {
    // given
    const make = (density: number) =>
      generateMine({
        ...base,
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
    const options = { ...base, density: 0.3, random: mulberry32(4) };

    // when
    const { grid } = generateMine(options);

    // then
    expect(floorShare(grid)).toBeGreaterThan(0.2);
    expect(floorShare(grid)).toBeLessThan(0.4);
  });

  it('fills the halls to their corners at a hall ragged of 0', () => {
    // given
    const options = {
      ...base,
      hallSize: { min: 12, max: 12 },
      hallRagged: 0,
      pillarSize: { min: 30, max: 30 },
      random: mulberry32(1),
    };

    // when
    const { grid, halls } = generateMine(options);

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
      ...base,
      hallSize: { min: 12, max: 12 },
      hallRagged: 1,
      pillarSize: { min: 30, max: 30 },
      random: mulberry32(1),
    };

    // when
    const { grid, halls } = generateMine(options);

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

  it('leaves pillars standing in the halls', () => {
    // given
    const options = {
      hallVeins: { min: 1, max: 1 },
      ...base,
      random: mulberry32(1),
    };

    // when
    const result = generateMine(options);

    // then
    expect(findPillars(result).length).toBeGreaterThan(3);
  });

  it('leaves no pillars when none fits in a hall', () => {
    // given
    const options = {
      hallVeins: { min: 1, max: 1 },
      ...base,
      hallSize: { min: 8, max: 8 },
      pillarSize: { min: 9, max: 9 },
      random: mulberry32(1),
    };

    // when
    const result = generateMine(options);

    // then
    expect(findPillars(result)).toEqual([]);
  });

  it('makes clean rectangles of the pillars at a pillar ragged of 0', () => {
    // given
    const options = {
      hallVeins: { min: 1, max: 1 },
      ...base,
      pillarRagged: 0,
      pillarSize: { min: 3, max: 6 },
      random: mulberry32(1),
    };

    // when
    const result = generateMine(options);

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
      hallVeins: { min: 1, max: 1 },
      ...base,
      pillarRagged: 0,
      pillarSize: { min: 3, max: 6 },
      random: mulberry32(2),
    };

    // when
    const result = generateMine(options);

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
      hallVeins: { min: 1, max: 1 },
      ...base,
      pillarRagged: 1,
      pillarSize: { min: 6, max: 8 },
      random: mulberry32(1),
    };

    // when
    const result = generateMine(options);

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
      generateMine({
        ...base,
        hallVeins: { min: 1, max: 1 },
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
      hallVeins: { min: 1, max: 1 },
      ...base,
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
    const result = generateMine(options);

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
      hallVeins: { min: 1, max: 1 },
      ...base,
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
    const result = generateMine(options);

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

  it('digs as many veins as hall veins says between two halls', () => {
    // given
    const options = {
      ...base,
      halls: { min: 2, max: 2 },
      hallVeins: { min: 4, max: 4 },
      random: mulberry32(1),
    };

    // when
    const { halls, passages } = generateMine(options);

    // then
    expect(halls).toHaveLength(2);
    expect(passages).toHaveLength(4);
  });

  it('digs the veins that join the halls even when hall veins asks for fewer', () => {
    // given
    const options = {
      ...base,
      halls: { min: 4, max: 4 },
      hallVeins: { min: 1, max: 1 },
      random: mulberry32(2),
    };

    // when
    const { halls, passages, grid } = generateMine(options);

    // then
    expect(passages).toHaveLength(halls.length - 1);
    expect(findCaveRegions(grid)).toHaveLength(1);
  });

  it('digs more veins with more halls and a higher hall veins', () => {
    // given
    const make = (hallVeins: number) =>
      generateMine({
        ...base,
        halls: { min: 3, max: 3 },
        hallVeins: { min: hallVeins, max: hallVeins },
        random: mulberry32(3),
      }).passages.length;

    // when
    const few = make(1);
    const many = make(7);

    // then
    expect(few).toBe(2);
    expect(many).toBe(7);
  });

  it('starts and ends every vein in a hall', () => {
    // given
    const options = {
      ...base,
      halls: { min: 3, max: 3 },
      hallVeins: { min: 6, max: 6 },
      random: mulberry32(4),
    };

    // when
    const { halls, passages } = generateMine(options);

    // then
    const inside = (tile?: { x: number; y: number }) =>
      halls.some(
        (hall) =>
          (tile?.x ?? -1) >= hall.x &&
          (tile?.x ?? -1) < hall.x + hall.width &&
          (tile?.y ?? -1) >= hall.y &&
          (tile?.y ?? -1) < hall.y + hall.height,
      );
    for (const { tiles } of passages) {
      expect(inside(tiles[0])).toBe(true);
      expect(inside(tiles[tiles.length - 1])).toBe(true);
    }
  });

  it('joins the same two halls by veins that start in different places', () => {
    // given
    const options = {
      ...base,
      halls: { min: 2, max: 2 },
      hallVeins: { min: 4, max: 4 },
      random: mulberry32(5),
    };

    // when
    const { passages } = generateMine(options);

    // then
    const starts = new Set(
      passages.map(
        ({ tiles }) => `${String(tiles[0]?.x)},${String(tiles[0]?.y)}`,
      ),
    );
    expect(starts.size).toBeGreaterThan(1);
  });

  it('digs no veins at all for a single hall, whatever hall veins says', () => {
    // given
    const options = {
      ...base,
      halls: { min: 1, max: 1 },
      hallVeins: { min: 5, max: 5 },
      random: mulberry32(1),
    };

    // when
    const { passages } = generateMine(options);

    // then
    expect(passages).toEqual([]);
  });

  it('keeps the mine connected with many veins', () => {
    // given
    const seeds = Array.from({ length: 15 }, (_, i) => i + 1);

    // when
    const mines = seeds.map((seed) =>
      generateMine({
        ...base,
        hallVeins: { min: 3, max: 9 },
        random: mulberry32(seed),
      }),
    );

    // then
    for (const { grid } of mines) {
      expect(findCaveRegions(grid)).toHaveLength(1);
    }
  });

  it('adds exits on the border and keeps the mine connected', () => {
    // given
    const options = { ...base, minExits: 3, random: mulberry32(1) };

    // when
    const { grid, exits } = generateMine(options);

    // then
    expect(exits).toHaveLength(3);
    for (const { x, y } of exits) {
      expect(grid.get(x, y)).toBe(Tile.Door);
    }
    expect(findCaveRegions(grid)).toHaveLength(1);
  });

  it('lists no halls for the other layouts', () => {
    // given
    const layouts = ['fishbone', 'veins'] as const;

    // when
    const results = layouts.map((layout) =>
      generateMine({ ...base, layout, random: mulberry32(1) }),
    );

    // then
    for (const { halls } of results) {
      expect(halls).toEqual([]);
    }
  });

  it('ignores the options of the other layouts', () => {
    // given
    const plain = generateMine({ ...base, random: mulberry32(1) });

    // when
    const other = generateMine({
      ...base,
      shaftWidth: { min: 5, max: 5 },
      aditLength: { min: 1, max: 2 },
      veinSpacing: 5,
      loops: 1,
      random: mulberry32(1),
    });

    // then
    expect(other.grid.toString()).toBe(plain.grid.toString());
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
      generateMine({ width, height, layout: 'pillars', random: mulberry32(1) }),
    );

    // then
    expect(mines).toHaveLength(sizes.length);
  });

  it.each([
    ['halls', { halls: { min: 0, max: 2 } }],
    ['halls', { halls: { min: 3, max: 2 } }],
    ['hallVeins', { hallVeins: { min: 0, max: 2 } }],
    ['hallVeins', { hallVeins: { min: 5, max: 2 } }],
    ['hallSize', { hallSize: { min: 0, max: 5 } }],
    ['hallRagged', { hallRagged: 1.5 }],
    ['pillarSize', { pillarSize: { min: 1.5, max: 3 } }],
    ['pillarSpacing', { pillarSpacing: { min: 0, max: 3 } }],
    ['pillarRagged', { pillarRagged: -0.1 }],
    ['pillarJitter', { pillarJitter: 2 }],
  ])('throws a RangeError for an invalid %s', (_name, invalid) => {
    // given
    const options = { ...base, ...invalid };

    // when
    const generate = () => generateMine(options);

    // then
    expect(generate).toThrow(RangeError);
  });
});
