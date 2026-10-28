import { describe, expect, it } from 'vitest';
import { Grid } from '../core/grid';
import type { Point } from '../core/point';
import { Tile } from '../core/tile';
import { findHallBoundary } from './find-hall-boundary';
import { findOutsideRock } from './find-outside-rock';

/** Carves a rectangle of floor and returns its tiles. */
function carve(
  grid: Grid,
  x: number,
  y: number,
  width: number,
  height: number,
) {
  const tiles: Point[] = [];
  for (let ty = y; ty < y + height; ++ty) {
    for (let tx = x; tx < x + width; ++tx) {
      grid.set(tx, ty, Tile.Floor);
      tiles.push({ x: tx, y: ty });
    }
  }
  return tiles;
}

describe('findHallBoundary', () => {
  it('finds the outline of a hall and not its inside', () => {
    // given
    const grid = new Grid(20, 20);
    const floor = carve(grid, 5, 5, 6, 5);

    // when
    const boundary = findHallBoundary(grid, floor);

    // then
    expect(boundary).toHaveLength(6 * 5 - 4 * 3);
    expect(boundary).not.toContainEqual({ x: 7, y: 7 });
    expect(boundary).toContainEqual({ x: 5, y: 5 });
  });

  it('leaves out tiles that touch only the outer ring of the map', () => {
    // given
    const grid = new Grid(10, 10);
    const floor = carve(grid, 1, 1, 8, 8);

    // when
    const boundary = findHallBoundary(grid, floor);

    // then
    expect(boundary).toEqual([]);
  });

  it('leaves out tiles that a vein has walled in', () => {
    // given
    const grid = new Grid(20, 20);
    const floor = carve(grid, 5, 5, 6, 5);
    carve(grid, 11, 5, 3, 5);

    // when
    const boundary = findHallBoundary(grid, floor);

    // then
    expect(boundary).not.toContainEqual({ x: 10, y: 7 });
    expect(boundary).toContainEqual({ x: 9, y: 5 });
  });

  it('leaves out a tile that only a pillar is next to, when told which wall is outside', () => {
    // given
    const grid = new Grid(30, 30);
    const floor = carve(grid, 5, 5, 12, 12);
    grid.set(10, 10, Tile.Wall);
    const outside = findOutsideRock(grid);

    // when
    const boundary = findHallBoundary(grid, floor, outside);

    // then
    expect(boundary.some(({ x, y }) => x === 10 && y === 11)).toBe(false);
    expect(boundary.some(({ x, y }) => x === 5 && y === 10)).toBe(true);
  });
});
