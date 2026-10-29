import { describe, expect, it } from 'vitest';
import { Grid } from '../core/grid';
import { Tile } from '../core/tile';
import { findOutsideRock } from './find-outside-rock';

describe('findOutsideRock', () => {
  it('marks the wall that joins the border and not the floor', () => {
    // given
    const grid = new Grid(10, 10);
    grid.set(5, 5, Tile.Floor);

    // when
    const outside = findOutsideRock(grid);

    // then
    expect(outside[0]).toBe(1);
    expect(outside[4 * 10 + 5]).toBe(1);
    expect(outside[5 * 10 + 5]).toBe(0);
  });

  it('leaves out wall that floor shuts in', () => {
    // given
    const grid = new Grid(12, 12);
    for (let y = 3; y <= 7; ++y) {
      for (let x = 3; x <= 7; ++x) {
        grid.set(x, y, Tile.Floor);
      }
    }
    grid.set(5, 5, Tile.Wall);

    // when
    const outside = findOutsideRock(grid);

    // then
    expect(outside[5 * 12 + 5]).toBe(0);
    expect(outside[2 * 12 + 2]).toBe(1);
  });

  it('does not pass between wall tiles that touch only at a corner', () => {
    // given
    const grid = new Grid(8, 8);
    for (let y = 1; y < 7; ++y) {
      for (let x = 1; x < 7; ++x) {
        grid.set(x, y, Tile.Floor);
      }
    }
    grid.set(3, 3, Tile.Wall);
    grid.set(4, 4, Tile.Wall);

    // when
    const outside = findOutsideRock(grid);

    // then
    expect(outside[3 * 8 + 3]).toBe(0);
    expect(outside[4 * 8 + 4]).toBe(0);
  });
});
