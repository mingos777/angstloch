import { describe, expect, it } from 'vitest';
import { findCaveRegions } from './find-cave-regions';
import { Grid } from './grid';
import { Tile } from './tile';

function parse(rows: string[]): Grid {
  const grid = new Grid(rows[0]?.length ?? 0, rows.length);
  rows.forEach((row, y) => {
    for (let x = 0; x < row.length; ++x) {
      grid.set(x, y, row.charAt(x) === '.' ? Tile.Floor : Tile.Wall);
    }
  });
  return grid;
}

describe('findCaveRegions', () => {
  it('finds nothing in a map without floor', () => {
    // given
    const grid = parse(['###', '###']);

    // when
    const regions = findCaveRegions(grid);

    // then
    expect(regions).toEqual([]);
  });

  it('groups floor tiles that touch along an edge', () => {
    // given
    const grid = parse(['..#..', '#.#.#', '#...#']);

    // when
    const regions = findCaveRegions(grid);

    // then
    expect(regions.map((tiles) => tiles.length)).toEqual([9]);
  });

  it('does not join floor tiles that only touch diagonally', () => {
    // given
    const grid = parse(['.#', '#.']);

    // when
    const regions = findCaveRegions(grid);

    // then
    expect(regions.map((tiles) => tiles.length)).toEqual([1, 1]);
  });

  it('sorts the regions from the largest to the smallest', () => {
    // given
    const grid = parse(['.#..#...', '#######.']);

    // when
    const regions = findCaveRegions(grid);

    // then
    expect(regions.map((tiles) => tiles.length)).toEqual([4, 2, 1]);
  });

  it('keeps the order of discovery for regions of equal size', () => {
    // given
    const grid = parse(['..#..']);

    // when
    const regions = findCaveRegions(grid);

    // then
    expect(regions.map((tiles) => tiles[0]?.x)).toEqual([0, 3]);
  });
});
