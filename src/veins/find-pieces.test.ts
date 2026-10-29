import { describe, expect, it } from 'vitest';
import { Grid } from '../core/grid';
import { Tile } from '../core/tile';
import { findPieces } from './find-pieces';

describe('findPieces', () => {
  it('finds nothing on a map of wall', () => {
    // given
    const grid = new Grid(10, 10);

    // when
    const pieces = findPieces(grid);

    // then
    expect(pieces).toEqual([]);
  });

  it('groups tiles that touch along edges, in the order of their first tile', () => {
    // given
    const grid = new Grid(10, 10);
    grid.set(5, 1, Tile.Floor);
    grid.set(5, 2, Tile.Door);
    grid.set(1, 4, Tile.Floor);
    grid.set(2, 4, Tile.Floor);

    // when
    const pieces = findPieces(grid);

    // then
    expect(pieces.map((piece) => piece.length)).toEqual([2, 2]);
    expect(pieces[0]).toContainEqual({ x: 5, y: 2 });
  });

  it('keeps tiles that only touch at a corner apart', () => {
    // given
    const grid = new Grid(10, 10);
    grid.set(2, 2, Tile.Floor);
    grid.set(3, 3, Tile.Floor);

    // when
    const pieces = findPieces(grid);

    // then
    expect(pieces).toHaveLength(2);
  });
});
