import { describe, expect, it } from 'vitest';
import type { Grid } from '../core/grid';
import type { Point } from '../core/point';
import { Tile } from '../core/tile';
import { emptyMap } from '../pipeline/empty-map';
import { pipeline } from '../pipeline/pipeline';
import { Reserve } from '../pipeline/reserve';
import { reserveTile } from '../pipeline/reserve-tile';
import { stampTile } from '../pipeline/stamp-tile';
import { step } from '../pipeline/step';
import { mulberry32 } from '../test-helpers/mulberry32';
import { digMaze } from './dig-maze';
import type { DigMazeOptions } from './dig-maze-options';

const NEIGHBORS: readonly Point[] = [
  { x: 0, y: -1 },
  { x: 1, y: 0 },
  { x: 0, y: 1 },
  { x: -1, y: 0 },
];

/** Runs the step alone on a wall map, 21 by 21 unless asked otherwise. */
function carve(
  options: DigMazeOptions = {},
  { seed = 1, width = 21, height = 21 } = {},
) {
  return pipeline(
    emptyMap({ width, height, tile: Tile.Wall }),
    [digMaze(options)],
    { random: mulberry32(seed) },
  );
}

function floorTiles(grid: Grid): Point[] {
  const tiles: Point[] = [];
  for (let y = 0; y < grid.height; ++y) {
    for (let x = 0; x < grid.width; ++x) {
      if (grid.get(x, y) === Tile.Floor) {
        tiles.push({ x, y });
      }
    }
  }
  return tiles;
}

/** How many floor tiles can be reached from a tile, moving orthogonally. */
function reachable(grid: Grid, from: Point): number {
  const seen = new Set([from.y * grid.width + from.x]);
  const queue = [from];
  for (let point = queue.shift(); point; point = queue.shift()) {
    for (const n of NEIGHBORS) {
      const next = { x: point.x + n.x, y: point.y + n.y };
      const key = next.y * grid.width + next.x;
      if (grid.get(next.x, next.y) === Tile.Floor && !seen.has(key)) {
        seen.add(key);
        queue.push(next);
      }
    }
  }
  return seen.size;
}

function deadEnds(grid: Grid): number {
  return floorTiles(grid).filter(
    ({ x, y }) =>
      x % 2 === 1 &&
      y % 2 === 1 &&
      NEIGHBORS.filter((n) => grid.get(x + n.x, y + n.y) === Tile.Floor)
        .length === 1,
  ).length;
}

/** The floor tiles between two cells of a row and of a column. */
function passages(grid: Grid) {
  const tiles = floorTiles(grid);
  return {
    horizontal: tiles.filter(({ x, y }) => x % 2 === 0 && y % 2 === 1).length,
    vertical: tiles.filter(({ x, y }) => x % 2 === 1 && y % 2 === 0).length,
  };
}

/** The cells where a corridor turns or branches. */
function corners(grid: Grid): number {
  return floorTiles(grid).filter(({ x, y }) => {
    if (x % 2 === 0 || y % 2 === 0) {
      return false;
    }
    const horizontal =
      grid.get(x - 1, y) === Tile.Floor || grid.get(x + 1, y) === Tile.Floor;
    const vertical =
      grid.get(x, y - 1) === Tile.Floor || grid.get(x, y + 1) === Tile.Floor;
    return horizontal && vertical;
  }).length;
}

/**
 * Horizontal share of the passages in the wedges left and right of the center
 * (`sides`) and above and below it (`ends`).
 */
function horizontalShares(grid: Grid) {
  const center = {
    x: Math.floor(grid.width / 2),
    y: Math.floor(grid.height / 2),
  };
  const counts = {
    sides: { horizontal: 0, vertical: 0 },
    ends: { horizontal: 0, vertical: 0 },
  };
  for (const { x, y } of floorTiles(grid)) {
    const wedge =
      Math.abs(x - center.x) > Math.abs(y - center.y) ? 'sides' : 'ends';
    if (x % 2 === 0 && y % 2 === 1) {
      counts[wedge].horizontal++;
    } else if (x % 2 === 1 && y % 2 === 0) {
      counts[wedge].vertical++;
    }
  }
  const share = ({ horizontal, vertical }: typeof counts.sides) =>
    horizontal / (horizontal + vertical);
  return { sides: share(counts.sides), ends: share(counts.ends) };
}

/** A step that runs first and changes the map, standing in for the steps a maze may follow. */
function before(change: Parameters<typeof step>[2]) {
  return step('before', {}, change);
}

describe('digMaze', () => {
  it('carves every cell of an odd-sized map', () => {
    // given
    const options = {};

    // when
    const { grid } = carve(options);

    // then
    for (let y = 1; y < 20; y += 2) {
      for (let x = 1; x < 20; x += 2) {
        expect(grid.get(x, y)).toBe(Tile.Floor);
      }
    }
  });

  it('makes a perfect maze: connected, with one route between cells', () => {
    // given
    const cells = 10 * 10;

    // when
    const { grid, start } = carve();

    // then
    expect(start).toBeDefined();
    expect(reachable(grid, start ?? { x: 1, y: 1 })).toBe(2 * cells - 1);
    expect(floorTiles(grid)).toHaveLength(2 * cells - 1);
  });

  it('leaves the wall frame alone', () => {
    // given
    const size = 21;

    // when
    const { grid } = carve();

    // then
    for (let i = 0; i < size; ++i) {
      expect(grid.get(i, 0)).toBe(Tile.Wall);
      expect(grid.get(i, size - 1)).toBe(Tile.Wall);
      expect(grid.get(0, i)).toBe(Tile.Wall);
      expect(grid.get(size - 1, i)).toBe(Tile.Wall);
    }
  });

  it('removes every dead end when the loop chance is 1', () => {
    // given
    const loopChance = 1;

    // when
    const { grid } = carve({ loopChance });

    // then
    expect(deadEnds(grid)).toBe(0);
  });

  it('carves only the requested fraction of the cells', () => {
    // given
    const fill = 0.5;

    // when
    const { grid } = carve({ fill });

    // then
    const cells = floorTiles(grid).filter(({ x, y }) => x % 2 && y % 2);
    expect(cells).toHaveLength(50);
  });

  it('starts at the cell nearest the middle by default', () => {
    // given
    const options = {};

    // when
    const { start } = carve(options);

    // then
    expect(start).toEqual({ x: 11, y: 11 });
  });

  it('starts at the requested cell', () => {
    // given
    const start = { x: 3, y: 17 };

    // when
    const result = carve({ start });

    // then
    expect(result.start).toEqual(start);
    expect(result.grid.get(3, 17)).toBe(Tile.Floor);
  });

  it('carves a tiny maze consisting of a single cell', () => {
    // given
    const size = { width: 3, height: 3 };

    // when
    const { grid } = carve({}, size);

    // then
    expect(grid.toString()).toBe('###\n#.#\n###');
  });

  it('leaves dead ends in a perfect maze', () => {
    // given
    const options = {};

    // when
    const { grid } = carve(options);

    // then
    expect(deadEnds(grid)).toBeGreaterThan(0);
  });

  it('adds loops when the loop chance is above 0', () => {
    // given
    const loopChance = 0.5;

    // when
    const { grid, start } = carve({ loopChance });

    // then
    const floor = floorTiles(grid).length;
    expect(floor).toBeGreaterThan(2 * 10 * 10 - 1);
    expect(reachable(grid, start ?? { x: 1, y: 1 })).toBe(floor);
  });

  it('carves a single cell when the fill is 0', () => {
    // given
    const fill = 0;

    // when
    const { grid, start } = carve({ fill });

    // then
    expect(floorTiles(grid)).toEqual([start]);
  });

  it('picks a valid default start on even-sized maps', () => {
    // given
    const size = { width: 4, height: 6 };

    // when
    const { grid, start } = carve({}, size);

    // then
    expect(start).toEqual({ x: 1, y: 3 });
    expect(grid.get(1, 3)).toBe(Tile.Floor);
  });

  it('prefers horizontal corridors when horizontal bias dominates', () => {
    // given
    const options = { horizontalBias: 1, verticalBias: 0 };

    // when
    const { horizontal, vertical } = passages(carve(options).grid);

    // then
    expect(horizontal).toBeGreaterThan(2 * vertical);
  });

  it('prefers vertical corridors when vertical bias dominates', () => {
    // given
    const options = { horizontalBias: 1, verticalBias: 5 };

    // when
    const { horizontal, vertical } = passages(carve(options).grid);

    // then
    expect(vertical).toBeGreaterThan(horizontal);
  });

  it('winds less when straight corridors are preferred', () => {
    // given
    const winding = carve({ straight: 0 });

    // when
    const straight = carve({ straight: 1 });

    // then
    expect(corners(straight.grid)).toBeLessThan(corners(winding.grid));
  });

  it.each(['whirlpool', 'snowflake'] as const)(
    'lays out a perfect maze differently with the %s pattern',
    (pattern) => {
      // given
      const plain = carve({}, { width: 41, height: 41 });

      // when
      const patterned = carve({ pattern }, { width: 41, height: 41 });

      // then
      expect(patterned.grid.toString()).not.toBe(plain.grid.toString());
      expect(floorTiles(patterned.grid)).toHaveLength(2 * 20 * 20 - 1);
    },
  );

  it('radiates corridors from the center with the snowflake pattern', () => {
    // given
    const pattern = 'snowflake';

    // when
    const shares = horizontalShares(
      carve({ pattern }, { width: 41, height: 41 }).grid,
    );

    // then
    expect(shares.sides).toBeGreaterThan(0.75);
    expect(shares.ends).toBeLessThan(0.25);
  });

  it('twirls corridors around the center with the whirlpool pattern', () => {
    // given
    const pattern = 'whirlpool';

    // when
    const shares = horizontalShares(
      carve({ pattern }, { width: 41, height: 41 }).grid,
    );

    // then
    expect(shares.sides).toBeLessThan(0.25);
    expect(shares.ends).toBeGreaterThan(0.75);
  });

  it('enforces the pattern more strongly as its chance grows', () => {
    // given
    const pattern = 'snowflake';

    // when
    const [none, some, full] = [0, 0.5, 1].map(
      (patternChance) =>
        horizontalShares(
          carve({ pattern, patternChance }, { width: 41, height: 41 }).grid,
        ).sides,
    );

    // then
    expect(none).toBeLessThan(0.6);
    expect(some).toBeGreaterThan(none ?? 0);
    expect(full).toBeGreaterThan(some ?? 1);
  });

  it('ignores the pattern chance when there is no pattern', () => {
    // given
    const plain = carve({ pattern: 'none', patternChance: 0 });

    // when
    const other = carve({ pattern: 'none', patternChance: 1 });

    // then
    expect(other.grid.toString()).toBe(plain.grid.toString());
  });

  it('keeps off reserved tiles', () => {
    // given: a reserved wall across the map, which splits the maze in two
    const reserve = before((state) => {
      for (let x = 0; x < 21; ++x) {
        reserveTile(state, x, 10, Reserve.Solid);
      }
      return {};
    });

    // when
    const { grid, start } = pipeline(
      emptyMap({ width: 21, height: 21, tile: Tile.Wall }),
      [reserve, digMaze()],
      { random: mulberry32(1) },
    );

    // then
    for (let x = 0; x < 21; ++x) {
      expect(grid.get(x, 10)).toBe(Tile.Wall);
    }
    expect(reachable(grid, start ?? { x: 1, y: 1 })).toBe(2 * 50 - 1);
  });

  it('carves the parts that a reserved tile cuts off', () => {
    // given
    const reserve = before((state) => {
      for (let x = 0; x < 21; ++x) {
        reserveTile(state, x, 10, Reserve.Solid);
      }
      return {};
    });

    // when
    const { grid } = pipeline(
      emptyMap({ width: 21, height: 21, tile: Tile.Wall }),
      [reserve, digMaze()],
      { random: mulberry32(1) },
    );

    // then
    expect(grid.get(1, 1)).toBe(Tile.Floor);
    expect(grid.get(1, 19)).toBe(Tile.Floor);
  });

  it('keeps off floor that an earlier step built', () => {
    // given
    const dig = before((state) => {
      stampTile(state, 5, 5, Tile.Floor);
      return {};
    });

    // when
    const { grid } = pipeline(
      emptyMap({ width: 21, height: 21, tile: Tile.Wall }),
      [dig, digMaze()],
      { random: mulberry32(1) },
    );

    // then
    for (const n of NEIGHBORS) {
      expect(grid.get(5 + n.x, 5 + n.y)).toBe(Tile.Wall);
    }
  });

  it('fails the attempt for a start that is reserved', () => {
    // given
    const reserve = before((state) => {
      reserveTile(state, 3, 3, Reserve.Solid);
      return {};
    });

    // when
    const act = () =>
      pipeline(
        emptyMap({ width: 21, height: 21, tile: Tile.Wall }),
        [reserve, digMaze({ start: { x: 3, y: 3 } })],
        { random: mulberry32(1), attempts: 1 },
      );

    // then
    expect(act).toThrow(/start \(3, 3\) is not free/);
  });

  it('carves a maze in an area on the lattice of the map', () => {
    // given
    const area = { width: { min: 9, max: 9 }, height: { min: 7, max: 7 } };

    // when
    const { grid, start } = carve({ area }, { width: 41, height: 31 });

    // then
    const tiles = floorTiles(grid);
    const xs = tiles.map(({ x }) => x);
    const ys = tiles.map(({ y }) => y);
    expect(Math.max(...xs) - Math.min(...xs)).toBe(6);
    expect(Math.max(...ys) - Math.min(...ys)).toBe(4);
    expect(Math.min(...xs) % 2).toBe(1);
    expect(Math.min(...ys) % 2).toBe(1);
    expect(tiles).toHaveLength(2 * 4 * 3 - 1);
    expect(start && grid.get(start.x, start.y)).toBe(Tile.Floor);
  });

  it('carves a maze for each copy', () => {
    // given
    const area = { width: { min: 7, max: 7 }, height: { min: 7, max: 7 } };
    const count = { min: 2, max: 2 };

    // when
    const { grid, start } = carve({ area, count }, { width: 41, height: 31 });

    // then
    const tiles = floorTiles(grid);
    expect(tiles).toHaveLength(2 * (2 * 3 * 3 - 1));
    expect(reachable(grid, start ?? { x: 1, y: 1 })).toBe(2 * 3 * 3 - 1);
  });

  it('carves nothing and reports no start when the count is 0', () => {
    // given
    const area = { width: { min: 7, max: 7 } };
    const count = { min: 0, max: 0 };

    // when
    const result = carve({ area, count });

    // then
    expect(floorTiles(result.grid)).toHaveLength(0);
    expect(result.start).toBeUndefined();
  });

  it('is deterministic for a given source of randomness', () => {
    // given
    const options = { loopChance: 0.3, straight: 0.5 };

    // when
    const first = carve(options, { seed: 7 });
    const second = carve(options, { seed: 7 });

    // then
    expect(first.grid.toString()).toBe(second.grid.toString());
  });

  it('carves different mazes for different sources of randomness', () => {
    // given
    const options = {};

    // when
    const first = carve(options, { seed: 1 });
    const second = carve(options, { seed: 2 });

    // then
    expect(second.grid.toString()).not.toBe(first.grid.toString());
  });

  it('does not change the options', () => {
    // given
    const options: DigMazeOptions = {
      start: { x: 1, y: 1 },
      count: { min: 1, max: 1 },
    };
    const copy = structuredClone(options);

    // when
    carve(options);

    // then
    expect(options).toEqual(copy);
  });

  it('refuses a map that does not start as wall', () => {
    // given
    const base = emptyMap({ width: 21, height: 21, tile: Tile.Grass });

    // when
    const act = () => pipeline(base, [digMaze()]);

    // then
    expect(act).toThrow(/digs its floor out of rock/);
  });

  it.each([
    [
      'a start that is not a cell',
      { start: { x: 2, y: 3 } },
      /not a maze cell/,
    ],
    ['a start outside the map', { start: { x: 21, y: 3 } }, /not a maze cell/],
    [
      'a start with an area',
      { start: { x: 1, y: 1 }, area: { width: { min: 9, max: 9 } } },
      /whole map/,
    ],
    ['an area below 3', { area: { width: { min: 1, max: 5 } } }, /at least 3/],
    [
      'an area above the map',
      { area: { width: { min: 3, max: 25 } } },
      /exceed/,
    ],
    ['two copies on the whole map', { count: { min: 2, max: 2 } }, /count/],
  ])('rejects %s', (_, options: DigMazeOptions, message) => {
    // given
    const map = emptyMap({ width: 21, height: 21, tile: Tile.Wall });

    // when
    const act = () => pipeline(map, [digMaze(options)]);

    // then
    expect(act).toThrow(message);
  });

  it.each([
    ['horizontalBias', { horizontalBias: -1 }],
    ['verticalBias', { verticalBias: Infinity }],
    ['loopChance', { loopChance: 2 }],
    ['fill', { fill: -0.5 }],
    ['straight', { straight: 1.5 }],
    ['patternChance', { patternChance: 3 }],
    ['pattern', { pattern: 'spiral' }],
  ])('rejects an invalid %s', (name, options) => {
    // given
    const invalid = options as DigMazeOptions;

    // when
    const act = () => digMaze(invalid);

    // then
    expect(act).toThrow(new RegExp(name));
  });
});
