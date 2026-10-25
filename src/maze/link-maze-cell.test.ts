import { describe, expect, it } from 'vitest';
import { Grid } from '../core/grid';
import { linkMazeCell } from './link-maze-cell';
import { Tile } from '../core/tile';

/** A single carved cell in the top left corner of a 9x5 map. */
function carved() {
  const grid = new Grid(9, 5);
  grid.set(1, 1, Tile.Floor);
  return grid;
}

describe('linkMazeCell', () => {
  it('leaves a carved cell alone', () => {
    // given
    const grid = carved();

    // when
    const linked = linkMazeCell(grid, { x: 1, y: 1 }, () => false);

    // then
    expect(linked).toBe(true);
  });

  it('carves a passage to the nearest carved cell', () => {
    // given
    const grid = carved();

    // when
    const linked = linkMazeCell(grid, { x: 5, y: 1 }, () => false);

    // then
    expect(linked).toBe(true);
    for (const x of [1, 2, 3, 4, 5]) {
      expect(grid.get(x, 1)).toBe(Tile.Floor);
    }
  });

  it('goes around blocked cells', () => {
    // given
    const grid = carved();
    const isBlocked = (x: number, y: number) => x === 3 && y === 1;

    // when
    const linked = linkMazeCell(grid, { x: 5, y: 1 }, isBlocked);

    // then
    expect(linked).toBe(true);
    expect(grid.get(3, 1)).toBe(Tile.Wall);
    expect(grid.get(5, 3)).toBe(Tile.Floor);
  });

  it('carves nothing when no carved cell can be reached', () => {
    // given
    const grid = carved();
    const isBlocked = (x: number) => x === 3;

    // when
    const linked = linkMazeCell(grid, { x: 5, y: 1 }, isBlocked);

    // then
    expect(linked).toBe(false);
    expect(grid.get(5, 1)).toBe(Tile.Wall);
  });
});
