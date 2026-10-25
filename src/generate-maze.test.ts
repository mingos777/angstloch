import { describe, expect, it, vi } from 'vitest';
import { generateMaze } from './generate-maze';
import type { Grid } from './grid';
import type { MazeOptions } from './maze-options';
import type { Point } from './point';
import { mulberry32 } from './test-helpers/mulberry32';
import { Tile } from './tile';

const NEIGHBORS: readonly Point[] = [
  { x: 0, y: -1 },
  { x: 1, y: 0 },
  { x: 0, y: 1 },
  { x: -1, y: 0 },
];

function maze(options: Partial<MazeOptions> = {}, seed = 1) {
  return generateMaze({
    width: 21,
    height: 21,
    random: mulberry32(seed),
    ...options,
  });
}

function positions(grid: Grid, predicate: (x: number, y: number) => boolean) {
  const result: Point[] = [];
  for (let y = 0; y < grid.height; ++y) {
    for (let x = 0; x < grid.width; ++x) {
      if (predicate(x, y)) {
        result.push({ x, y });
      }
    }
  }
  return result;
}

function floors(grid: Grid) {
  return positions(grid, (x, y) => grid.get(x, y) === Tile.Floor);
}

function cells(grid: Grid) {
  return floors(grid).filter(({ x, y }) => x % 2 === 1 && y % 2 === 1);
}

function neighborCount(grid: Grid, { x, y }: Point) {
  return NEIGHBORS.filter((n) => grid.get(x + n.x, y + n.y) !== Tile.Wall)
    .length;
}

/** Counts the passable tiles reachable from `from`. */
function reachable(grid: Grid, from: Point) {
  const seen = new Set([`${String(from.x)},${String(from.y)}`]);
  const queue = [from];
  for (let point = queue.shift(); point; point = queue.shift()) {
    for (const n of NEIGHBORS) {
      const next = { x: point.x + n.x, y: point.y + n.y };
      const key = `${String(next.x)},${String(next.y)}`;
      if (grid.get(next.x, next.y) !== Tile.Wall && !seen.has(key)) {
        seen.add(key);
        queue.push(next);
      }
    }
  }
  return seen.size;
}

function passable(grid: Grid) {
  return positions(grid, (x, y) => grid.get(x, y) !== Tile.Wall).length;
}

function corners(grid: Grid) {
  return cells(grid).filter(({ x, y }) => {
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
  for (const { x, y } of floors(grid)) {
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

describe('generateMaze', () => {
  it('produces a grid of the requested size', () => {
    // given
    const options = { width: 15, height: 9 };

    // when
    const { grid } = maze(options);

    // then
    expect([grid.width, grid.height]).toEqual([15, 9]);
  });

  it('carves a tiny maze consisting of a single cell', () => {
    // given
    const options = { width: 3, height: 3 };

    // when
    const { grid } = maze(options);

    // then
    expect(grid.toString()).toBe('###\n#.#\n###');
  });

  it('carves every cell of an odd-sized map by default', () => {
    // given
    const options = { width: 21, height: 15 };

    // when
    const { grid } = maze(options);

    // then
    expect(cells(grid)).toHaveLength(10 * 7);
  });

  it('leaves the wall frame intact when there are no exits', () => {
    // given / when
    const { grid } = maze();
    const border = positions(
      grid,
      (x, y) => x === 0 || y === 0 || x === 20 || y === 20,
    );

    // then
    expect(border.every(({ x, y }) => grid.get(x, y) === Tile.Wall)).toBe(true);
  });

  it('makes a perfect maze by default: connected, with exactly one route between cells', () => {
    // given / when
    const { grid, start } = maze();

    // then
    expect(floors(grid)).toHaveLength(2 * cells(grid).length - 1);
    expect(reachable(grid, start)).toBe(floors(grid).length);
  });

  it('leaves dead ends in a perfect maze', () => {
    // given / when
    const { grid } = maze();
    const deadEnds = cells(grid).filter((c) => neighborCount(grid, c) === 1);

    // then
    expect(deadEnds.length).toBeGreaterThan(0);
  });

  it('removes all dead ends when the loop chance is 1', () => {
    // given / when
    const { grid } = maze({ loopChance: 1 });
    const deadEnds = cells(grid).filter((c) => neighborCount(grid, c) === 1);

    // then
    expect(deadEnds).toHaveLength(0);
  });

  it('adds loops when the loop chance is above 0', () => {
    // given / when
    const { grid, start } = maze({ loopChance: 1 });

    // then
    expect(floors(grid).length).toBeGreaterThan(2 * cells(grid).length - 1);
    expect(reachable(grid, start)).toBe(floors(grid).length);
  });

  it('carves only the requested fraction of the cells', () => {
    // given
    const options = { fill: 0.5 };

    // when
    const { grid, start } = maze(options);

    // then
    expect(cells(grid)).toHaveLength(50);
    expect(reachable(grid, start)).toBe(floors(grid).length);
  });

  it('carves a single cell when the fill is 0', () => {
    // given
    const options = { fill: 0 };

    // when
    const { grid } = maze(options);

    // then
    expect(floors(grid)).toHaveLength(1);
  });

  it('starts near the center by default', () => {
    // given / when
    const { start, grid } = maze();

    // then
    expect(start).toEqual({ x: 11, y: 11 });
    expect(grid.get(11, 11)).toBe(Tile.Floor);
  });

  it('picks a valid default start on even-sized maps', () => {
    // given
    const options = { width: 4, height: 6 };

    // when
    const { start, grid } = maze(options);

    // then
    expect(start).toEqual({ x: 1, y: 3 });
    expect(grid.get(1, 3)).toBe(Tile.Floor);
  });

  it('starts carving at the requested cell', () => {
    // given
    const options = { start: { x: 3, y: 5 }, fill: 0 };

    // when
    const { grid, start } = maze(options);

    // then
    expect(start).toEqual({ x: 3, y: 5 });
    expect(floors(grid)).toEqual([{ x: 3, y: 5 }]);
  });

  it.each([
    { x: 2, y: 3 },
    { x: 3, y: 4 },
    { x: 21, y: 3 },
    { x: -1, y: 3 },
    { x: 1.5, y: 3 },
  ])('rejects the start %o', (start) => {
    // given
    const generate = () => maze({ start });

    // when / then
    expect(generate).toThrow(RangeError);
  });

  it.each([
    { width: 2, height: 9 },
    { width: 9, height: 2 },
    { width: 9.5, height: 9 },
  ])('rejects the dimensions %o', (dimensions) => {
    // given
    const generate = () => maze(dimensions);

    // when / then
    expect(generate).toThrow(RangeError);
  });

  it('adds the requested number of exits as doors on the border', () => {
    // given
    const options = { minExits: 3, maxExits: 3 };

    // when
    const { grid, exits } = maze(options);

    // then
    expect(exits).toHaveLength(3);
    expect(exits.every(({ x, y }) => grid.get(x, y) === Tile.Door)).toBe(true);
    expect(
      exits.every(({ x, y }) => x === 0 || y === 0 || x === 20 || y === 20),
    ).toBe(true);
    expect(
      positions(grid, (x, y) => grid.get(x, y) === Tile.Door),
    ).toHaveLength(3);
  });

  it('adds a number of exits between min and max', () => {
    // given
    const options = { minExits: 1, maxExits: 4 };

    // when
    const counts = Array.from(
      { length: 20 },
      (_, seed) => maze(options, seed).exits.length,
    );

    // then
    expect(Math.min(...counts)).toBeGreaterThanOrEqual(1);
    expect(Math.max(...counts)).toBeLessThanOrEqual(4);
    expect(new Set(counts).size).toBeGreaterThan(1);
  });

  it('adds exactly minExits exits when maxExits is omitted', () => {
    // given
    const options = { minExits: 2 };

    // when
    const { exits } = maze(options);

    // then
    expect(exits).toHaveLength(2);
  });

  it('adds no exits by default', () => {
    // given / when
    const { exits } = maze();

    // then
    expect(exits).toEqual([]);
  });

  it('connects every exit to the maze, also on even-sized maps', () => {
    // given
    const options = { width: 20, height: 18, minExits: 4, maxExits: 4 };

    // when
    const { grid, start } = maze(options);

    // then
    expect(reachable(grid, start)).toBe(passable(grid));
  });

  it('tunnels from the border to a partially carved maze', () => {
    // given
    const options = { fill: 0, minExits: 1, start: { x: 9, y: 9 } };

    // when
    const { grid, exits } = maze(options);

    // then
    expect(exits).toHaveLength(1);
    expect(reachable(grid, { x: 9, y: 9 })).toBe(passable(grid));
  });

  it('prefers horizontal corridors when horizontal bias dominates', () => {
    // given
    const options = { horizontalBias: 1, verticalBias: 0 };

    // when
    const { grid } = maze(options);
    const horizontal = positions(
      grid,
      (x, y) => x % 2 === 0 && y % 2 === 1 && grid.get(x, y) === Tile.Floor,
    );
    const vertical = positions(
      grid,
      (x, y) => x % 2 === 1 && y % 2 === 0 && grid.get(x, y) === Tile.Floor,
    );

    // then
    expect(horizontal.length).toBeGreaterThan(2 * vertical.length);
  });

  it('prefers vertical corridors when vertical bias dominates', () => {
    // given
    const options = { horizontalBias: 1, verticalBias: 5 };

    // when
    const { grid } = maze(options);
    const horizontal = positions(
      grid,
      (x, y) => x % 2 === 0 && y % 2 === 1 && grid.get(x, y) === Tile.Floor,
    );
    const vertical = positions(
      grid,
      (x, y) => x % 2 === 1 && y % 2 === 0 && grid.get(x, y) === Tile.Floor,
    );

    // then
    expect(vertical.length).toBeGreaterThan(horizontal.length);
  });

  it('winds less when straight corridors are preferred', () => {
    // given / when
    const winding = maze({ straight: 0 });
    const straight = maze({ straight: 1 });

    // then
    expect(corners(straight.grid)).toBeLessThan(corners(winding.grid));
  });

  it.each(['whirlpool', 'snowflake'] as const)(
    'still makes a perfect maze with %s symmetry',
    (symmetry) => {
      // given
      const options = { symmetry };

      // when
      const { grid, start } = maze(options);

      // then
      expect(floors(grid)).toHaveLength(2 * cells(grid).length - 1);
      expect(reachable(grid, start)).toBe(floors(grid).length);
    },
  );

  it.each(['whirlpool', 'snowflake'] as const)(
    'lays out the maze differently with %s symmetry',
    (symmetry) => {
      // given
      const plain = maze();

      // when
      const symmetric = maze({ symmetry });

      // then
      expect(symmetric.grid.toString()).not.toBe(plain.grid.toString());
    },
  );

  it('radiates corridors from the center with snowflake symmetry', () => {
    // given
    const options = { width: 41, height: 41, symmetry: 'snowflake' } as const;

    // when
    const shares = horizontalShares(maze(options).grid);

    // then
    expect(shares.sides).toBeGreaterThan(0.75);
    expect(shares.ends).toBeLessThan(0.25);
  });

  it('twirls corridors around the center with whirlpool symmetry', () => {
    // given
    const options = { width: 41, height: 41, symmetry: 'whirlpool' } as const;

    // when
    const shares = horizontalShares(maze(options).grid);

    // then
    expect(shares.sides).toBeLessThan(0.25);
    expect(shares.ends).toBeGreaterThan(0.75);
  });

  it('enforces symmetry more strongly as its chance grows', () => {
    // given
    const options = { width: 41, height: 41, symmetry: 'snowflake' } as const;

    // when
    const [none, some, full] = [0, 0.5, 1].map(
      (symmetryChance) =>
        horizontalShares(maze({ ...options, symmetryChance }).grid).sides,
    );

    // then
    expect(none).toBeLessThan(0.6);
    expect(some).toBeGreaterThan(none ?? 0);
    expect(full).toBeGreaterThan(some ?? 1);
  });

  it('ignores the symmetry chance when there is no symmetry', () => {
    // given
    const plain = maze({ symmetry: 'none', symmetryChance: 0 });

    // when
    const other = maze({ symmetry: 'none', symmetryChance: 1 });

    // then
    expect(other.grid.toString()).toBe(plain.grid.toString());
  });

  it('produces the same maze for the same random sequence', () => {
    // given
    const options = {
      loopChance: 0.3,
      minExits: 2,
      symmetry: 'snowflake',
    } as const;

    // when
    const first = maze(options, 42);
    const second = maze(options, 42);

    // then
    expect(second.grid.toString()).toBe(first.grid.toString());
    expect(second.exits).toEqual(first.exits);
  });

  it('produces different mazes for different random sequences', () => {
    // given / when
    const first = maze({}, 1);
    const second = maze({}, 2);

    // then
    expect(second.grid.toString()).not.toBe(first.grid.toString());
  });

  it('draws randomness from the injected source only', () => {
    // given
    const spy = vi.spyOn(Math, 'random');
    const random = vi.fn(() => 0.5);

    // when
    generateMaze({ width: 9, height: 9, random });

    // then
    expect(random).toHaveBeenCalled();
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });

  it('falls back to Math.random when no source is injected', () => {
    // given
    const spy = vi.spyOn(Math, 'random').mockReturnValue(0);

    // when
    generateMaze({ width: 9, height: 9 });

    // then
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });
});
