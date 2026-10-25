import { describe, expect, it } from 'vitest';
import { Grid } from './grid';
import { Tile } from './tile';

describe('Grid', () => {
  it('starts out filled with walls', () => {
    // given
    const grid = new Grid(3, 2);

    // when
    const text = grid.toString();

    // then
    expect(text).toBe('###\n###');
  });

  it('starts out filled with the requested tile', () => {
    // given
    const grid = new Grid(2, 2, Tile.Floor);

    // when
    const text = grid.toString();

    // then
    expect(text).toBe('..\n..');
  });

  it.each([
    [0, 5],
    [5, 0],
    [-1, 5],
    [2.5, 5],
    [Number.NaN, 5],
  ])('rejects the dimensions %s x %s', (width, height) => {
    // given
    const create = () => new Grid(width, height);

    // when / then
    expect(create).toThrow(RangeError);
  });

  it('returns what was set', () => {
    // given
    const grid = new Grid(3, 3);

    // when
    grid.set(2, 1, Tile.Door);

    // then
    expect(grid.get(2, 1)).toBe(Tile.Door);
  });

  it('stores rows independently', () => {
    // given
    const grid = new Grid(3, 2);

    // when
    grid.set(0, 1, Tile.Floor);

    // then
    expect(grid.toString()).toBe('###\n.##');
  });

  it('treats positions outside the grid as walls', () => {
    // given
    const grid = new Grid(2, 2, Tile.Floor);

    // when
    const tiles = [
      grid.get(-1, 0),
      grid.get(0, -1),
      grid.get(2, 0),
      grid.get(0, 2),
    ];

    // then
    expect(tiles).toEqual([Tile.Wall, Tile.Wall, Tile.Wall, Tile.Wall]);
  });

  it('refuses to set a tile outside the grid', () => {
    // given
    const grid = new Grid(2, 2);

    // when
    const set = () => {
      grid.set(2, 0, Tile.Floor);
    };

    // then
    expect(set).toThrow(RangeError);
  });

  it('renders every tile kind', () => {
    // given
    const grid = new Grid(5, 1);
    grid.set(1, 0, Tile.Floor);
    grid.set(2, 0, Tile.Door);
    grid.set(3, 0, Tile.Grass);
    grid.set(4, 0, Tile.Tree);

    // when
    const text = grid.toString();

    // then
    expect(text).toBe('#.+"T');
  });

  it('clones into an independent grid', () => {
    // given
    const grid = new Grid(2, 2);
    const copy = grid.clone();

    // when
    copy.set(0, 0, Tile.Floor);

    // then
    expect(grid.get(0, 0)).toBe(Tile.Wall);
    expect(copy.toString()).toBe('.#\n##');
  });
});
