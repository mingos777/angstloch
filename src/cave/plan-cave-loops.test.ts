import { describe, expect, it } from 'vitest';
import { Grid } from '../core/grid';
import type { Point } from '../core/point';
import { planCaveLoops } from './plan-cave-loops';
import { Tile } from '../core/tile';

function row(grid: Grid, y: number, from: number, to: number): Point[] {
  const tiles: Point[] = [];
  for (let x = from; x <= to; ++x) {
    grid.set(x, y, Tile.Floor);
    tiles.push({ x, y });
  }
  return tiles;
}

/** Two caverns two tiles apart, joined by a tunnel that goes round the long way. */
function detour(): { grid: Grid; caverns: Point[][] } {
  const grid = new Grid(10, 5);
  const upper = row(grid, 1, 1, 3);
  const lower = row(grid, 3, 1, 3);
  row(grid, 1, 4, 8);
  row(grid, 3, 4, 8);
  grid.set(8, 2, Tile.Floor);
  return { grid, caverns: [upper, lower] };
}

describe('planCaveLoops', () => {
  it('proposes a tunnel across a thin wall when the way round is long', () => {
    // given
    const { grid, caverns } = detour();

    // when
    const links = planCaveLoops(grid, caverns);

    // then
    expect(links).toHaveLength(1);
    expect(links[0]?.from.y).toBe(1);
    expect(links[0]?.to.y).toBe(3);
    expect(links[0]?.from.x).toBe(links[0]?.to.x);
  });

  it('skips caverns that a short tunnel joins already', () => {
    // given
    const grid = new Grid(8, 3);
    const left = row(grid, 1, 1, 1);
    const right = row(grid, 1, 5, 5);
    row(grid, 1, 2, 4);

    // when
    const links = planCaveLoops(grid, [left, right]);

    // then
    expect(links).toEqual([]);
  });

  it('proposes a tunnel between caverns that are not joined at all', () => {
    // given
    const grid = new Grid(8, 3);
    const left = row(grid, 1, 1, 1);
    const right = row(grid, 1, 5, 5);

    // when
    const links = planCaveLoops(grid, [left, right]);

    // then
    expect(links).toEqual([{ from: { x: 1, y: 1 }, to: { x: 5, y: 1 } }]);
  });

  it('pairs a cavern with its three nearest neighbors only', () => {
    // given
    const grid = new Grid(11, 3);
    const caverns = [1, 3, 5, 7, 9].map((x) => row(grid, 1, x, x));

    // when
    const links = planCaveLoops(grid, caverns);

    // then
    const xs = links.map(({ from, to }) => [from.x, to.x].sort());
    expect(xs).not.toContainEqual([1, 9]);
    expect(xs).toContainEqual([1, 3]);
  });

  it('lists every pair once', () => {
    // given
    const grid = new Grid(8, 3);
    const caverns = [1, 3, 5].map((x) => row(grid, 1, x, x));

    // when
    const links = planCaveLoops(grid, caverns);

    // then
    const keys = links.map(({ from, to }) => [from.x, to.x].sort().join());
    expect(new Set(keys).size).toBe(keys.length);
    expect(keys).toHaveLength(3);
  });

  it('returns nothing for a single cavern or none', () => {
    // given
    const grid = new Grid(5, 3);
    const only = row(grid, 1, 1, 3);

    // when
    const links = [planCaveLoops(grid, [only]), planCaveLoops(grid, [])];

    // then
    expect(links).toEqual([[], []]);
  });
});
