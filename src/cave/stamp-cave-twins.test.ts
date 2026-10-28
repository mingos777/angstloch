import { describe, expect, it } from 'vitest';
import { createTransforms } from '../rooms/templates/create-transforms';
import { Grid } from '../core/grid';
import { stampCaveTwins } from './stamp-cave-twins';
import { Tile } from '../core/tile';

describe('stampCaveTwins', () => {
  it('copies the new floor onto its mirror images', () => {
    // given
    const before = new Grid(7, 5);
    const grid = before.clone();
    grid.set(1, 1, Tile.Floor);
    const images = createTransforms('both', 7, 5, false);

    // when
    stampCaveTwins(grid, before, images);

    // then
    for (const [x, y] of [
      [1, 1],
      [5, 1],
      [1, 3],
      [5, 3],
    ] as const) {
      expect(grid.get(x, y)).toBe(Tile.Floor);
    }
    expect(grid.toString().split('.').length - 1).toBe(4);
  });

  it('leaves floor that was there before alone', () => {
    // given
    const before = new Grid(7, 5);
    before.set(2, 2, Tile.Floor);
    const grid = before.clone();
    const images = createTransforms('horizontal', 7, 5, false);

    // when
    stampCaveTwins(grid, before, images);

    // then
    expect(grid.toString()).toBe(before.toString());
  });

  it('does nothing without images', () => {
    // given
    const before = new Grid(5, 5);
    const grid = before.clone();
    grid.set(1, 1, Tile.Floor);

    // when
    stampCaveTwins(grid, before, []);

    // then
    expect(grid.toString().split('.').length - 1).toBe(1);
  });

  it('leaves out a twin on a blocked tile', () => {
    // given
    const before = new Grid(7, 5);
    const grid = before.clone();
    grid.set(1, 1, Tile.Floor);
    const images = createTransforms('both', 7, 5, false);
    const blocked = new Uint8Array(7 * 5);
    blocked[1 * 7 + 5] = 1;

    // when
    stampCaveTwins(grid, before, images, blocked);

    // then
    expect(grid.get(5, 1)).toBe(Tile.Wall);
    expect(grid.toString().split('.').length - 1).toBe(3);
  });
});
