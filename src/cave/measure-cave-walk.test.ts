import { describe, expect, it } from 'vitest';
import { Grid } from '../core/grid';
import { measureCaveWalk } from './measure-cave-walk';
import { Tile } from '../core/tile';

describe('measureCaveWalk', () => {
  it('counts the steps along a straight corridor', () => {
    // given
    const grid = new Grid(8, 3);
    for (let x = 1; x <= 6; ++x) {
      grid.set(x, 1, Tile.Floor);
    }

    // when
    const steps = measureCaveWalk(grid, { x: 1, y: 1 }, { x: 6, y: 1 });

    // then
    expect(steps).toBe(5);
  });

  it('goes around rock', () => {
    // given
    const grid = new Grid(5, 5);
    for (const [x, y] of [
      [1, 1],
      [1, 2],
      [1, 3],
      [2, 3],
      [3, 3],
      [3, 2],
      [3, 1],
    ] as const) {
      grid.set(x, y, Tile.Floor);
    }

    // when
    const steps = measureCaveWalk(grid, { x: 1, y: 1 }, { x: 3, y: 1 });

    // then
    expect(steps).toBe(6);
  });

  it('is 0 for the same position', () => {
    // given
    const grid = new Grid(3, 3);
    grid.set(1, 1, Tile.Floor);

    // when
    const steps = measureCaveWalk(grid, { x: 1, y: 1 }, { x: 1, y: 1 });

    // then
    expect(steps).toBe(0);
  });

  it('is infinite when the floor does not join the positions', () => {
    // given
    const grid = new Grid(5, 3);
    grid.set(1, 1, Tile.Floor);
    grid.set(3, 1, Tile.Floor);

    // when
    const steps = measureCaveWalk(grid, { x: 1, y: 1 }, { x: 3, y: 1 });

    // then
    expect(steps).toBe(Infinity);
  });
});
