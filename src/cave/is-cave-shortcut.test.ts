import { describe, expect, it } from 'vitest';
import { Grid } from '../core/grid';
import { isCaveShortcut } from './is-cave-shortcut';
import { Tile } from '../core/tile';

function floors(grid: Grid, y: number, from: number, to: number): void {
  for (let x = from; x <= to; ++x) {
    grid.set(x, y, Tile.Floor);
  }
}

describe('isCaveShortcut', () => {
  it('is true when the walk is much longer than the gap', () => {
    // given
    const grid = new Grid(12, 5);
    floors(grid, 1, 1, 9);
    floors(grid, 3, 1, 9);
    grid.set(9, 2, Tile.Floor);

    // when
    const shortcut = isCaveShortcut(grid, {
      from: { x: 1, y: 1 },
      to: { x: 1, y: 3 },
    });

    // then
    expect(shortcut).toBe(true);
  });

  it('is false when the floor joins the ends by a short way', () => {
    // given
    const grid = new Grid(10, 3);
    floors(grid, 1, 1, 6);

    // when
    const shortcut = isCaveShortcut(grid, {
      from: { x: 1, y: 1 },
      to: { x: 6, y: 1 },
    });

    // then
    expect(shortcut).toBe(false);
  });

  it('is true when the floor does not join the ends', () => {
    // given
    const grid = new Grid(10, 3);
    grid.set(1, 1, Tile.Floor);
    grid.set(6, 1, Tile.Floor);

    // when
    const shortcut = isCaveShortcut(grid, {
      from: { x: 1, y: 1 },
      to: { x: 6, y: 1 },
    });

    // then
    expect(shortcut).toBe(true);
  });
});
