import { describe, expect, it } from 'vitest';
import type { MazeCarving } from './backtrack-maze';
import { backtrackMaze } from './backtrack-maze';
import { Grid } from '../core/grid';
import { mulberry32 } from '../test-helpers/mulberry32';
import { Tile } from '../core/tile';

/** An 11x11 map whose cells at x = 5 are blocked, which splits it in two. */
function carve(overrides: Partial<MazeCarving> = {}) {
  const grid = new Grid(11, 11);
  backtrackMaze({
    grid,
    random: mulberry32(1),
    start: { x: 1, y: 1 },
    horizontalBias: 0,
    verticalBias: 0,
    loopChance: 0,
    fill: 1,
    symmetry: 'none',
    symmetryChance: 1,
    straight: 0,
    isBlocked: (x) => x === 5,
    ...overrides,
  });
  return grid;
}

function floorCount(grid: Grid, from: number, to: number) {
  let count = 0;
  for (let y = 0; y < grid.height; ++y) {
    for (let x = from; x <= to; ++x) {
      if (grid.get(x, y) === Tile.Floor) {
        ++count;
      }
    }
  }
  return count;
}

describe('backtrackMaze', () => {
  it('leaves blocked cells alone', () => {
    // given
    const loopy = { loopChance: 1 };

    // when
    const grid = carve(loopy);

    // then
    expect(floorCount(grid, 4, 6)).toBe(0);
  });

  it('carves every region, not just the one with the start', () => {
    // given
    const start = { x: 1, y: 1 };

    // when
    const grid = carve({ start });

    // then
    expect(grid.get(9, 9)).toBe(Tile.Floor);
    expect(grid.get(7, 1)).toBe(Tile.Floor);
  });

  it('carves a perfect maze in each region', () => {
    // given
    const cellsPerRegion = 10;

    // when
    const grid = carve();

    // then: a tree of n cells has n - 1 passages, so 2n - 1 floor tiles
    expect(floorCount(grid, 0, 4)).toBe(2 * cellsPerRegion - 1);
    expect(floorCount(grid, 6, 10)).toBe(2 * cellsPerRegion - 1);
  });

  it('carves only the start when fill is 0', () => {
    // given
    const fill = 0;

    // when
    const grid = carve({ fill });

    // then
    expect(floorCount(grid, 0, 10)).toBe(1);
  });

  it('skips the regions after the start once fill is reached', () => {
    // given
    const fill = 0.5;

    // when
    const grid = carve({ fill });

    // then
    expect(floorCount(grid, 0, 4)).toBeGreaterThan(0);
    expect(floorCount(grid, 6, 10)).toBe(0);
  });

  it('carves the whole map without blocked cells', () => {
    // given
    const unblocked = { isBlocked: undefined };

    // when
    const grid = carve(unblocked);

    // then
    expect(floorCount(grid, 0, 10)).toBe(2 * 25 - 1);
  });

  it('digs no passage through a blocked tile', () => {
    // given
    const isBlocked = (x: number) => x === 4;

    // when
    const grid = carve({ isBlocked, loopChance: 1 });

    // then
    expect(floorCount(grid, 4, 4)).toBe(0);
  });
});
