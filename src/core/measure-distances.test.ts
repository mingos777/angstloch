import { describe, expect, it } from 'vitest';
import { Grid } from './grid';
import { measureDistances } from './measure-distances';
import type { Point } from './point';
import { Tile } from './tile';

const SYMBOLS: Record<string, Tile> = {
  '#': Tile.Wall,
  '.': Tile.Floor,
  '+': Tile.Door,
  '=': Tile.Road,
  '≈': Tile.DeepWater,
};

/** Builds a grid from rows of text, with the symbols of `Grid#toString`. */
function gridOf(...rows: string[]): Grid {
  const grid = new Grid(rows[0]?.length ?? 0, rows.length);
  rows.forEach((row, y) => {
    row.split('').forEach((symbol, x) => {
      grid.set(x, y, SYMBOLS[symbol] ?? Tile.Wall);
    });
  });
  return grid;
}

const at = (x: number, y: number): Point[] => [{ x, y }];

describe('measureDistances', () => {
  it('measures the walk along a corridor', () => {
    // given
    const grid = gridOf('......');

    // when
    const distances = measureDistances(grid, [at(0, 0), at(5, 0)]);

    // then
    expect(distances).toEqual([
      [0, 5],
      [5, 0],
    ]);
  });

  it('measures between the nearest tiles of two places', () => {
    // given
    const grid = gridOf('..........');
    const left = [0, 1, 2].map((x) => ({ x, y: 0 }));
    const right = [7, 8, 9].map((x) => ({ x, y: 0 }));

    // when
    const distances = measureDistances(grid, [left, right]);

    // then
    expect(distances[0]?.[1]).toBe(5);
  });

  it('gives 0 between places that share a tile', () => {
    // given
    const grid = gridOf('....');

    // when
    const distances = measureDistances(grid, [
      [
        { x: 0, y: 0 },
        { x: 1, y: 0 },
      ],
      [
        { x: 1, y: 0 },
        { x: 2, y: 0 },
      ],
    ]);

    // then
    expect(distances[0]?.[1]).toBe(0);
  });

  it('gives -1 where there is no way', () => {
    // given
    const grid = gridOf('..#..');

    // when
    const distances = measureDistances(grid, [at(0, 0), at(4, 0)]);

    // then
    expect(distances).toEqual([
      [0, -1],
      [-1, 0],
    ]);
  });

  it('walks round a wall', () => {
    // given
    const grid = gridOf('.#.', '...');

    // when
    const distances = measureDistances(grid, [at(0, 0), at(2, 0)], {
      metric: 'manhattan',
    });

    // then
    expect(distances[0]?.[1]).toBe(4);
  });

  it('counts a diagonal step as the square root of 2 by default', () => {
    // given
    const grid = gridOf('..', '..');

    // when
    const distances = measureDistances(grid, [at(0, 0), at(1, 1)]);

    // then
    expect(distances[0]?.[1]).toBe(Math.SQRT2);
  });

  it('counts a diagonal step as 1 with the chebyshev metric', () => {
    // given
    const grid = gridOf('..', '..');

    // when
    const distances = measureDistances(grid, [at(0, 0), at(1, 1)], {
      metric: 'chebyshev',
    });

    // then
    expect(distances[0]?.[1]).toBe(1);
  });

  it('takes no diagonal steps with the manhattan metric', () => {
    // given
    const grid = gridOf('..', '..');

    // when
    const distances = measureDistances(grid, [at(0, 0), at(1, 1)], {
      metric: 'manhattan',
    });

    // then
    expect(distances[0]?.[1]).toBe(2);
  });

  it('cuts between two walls that touch at a corner', () => {
    // given
    const grid = gridOf('.#', '#.');

    // when
    const distances = measureDistances(grid, [at(0, 0), at(1, 1)], {
      metric: 'chebyshev',
    });

    // then
    expect(distances[0]?.[1]).toBe(1);
  });

  it('walks through doors at a factor of 1 by default', () => {
    // given
    const grid = gridOf('.+.');

    // when
    const distances = measureDistances(grid, [at(0, 0), at(2, 0)]);

    // then
    expect(distances[0]?.[1]).toBe(2);
  });

  it('does not enter deep water by default', () => {
    // given
    const grid = gridOf('.≈.');

    // when
    const distances = measureDistances(grid, [at(0, 0), at(2, 0)]);

    // then
    expect(distances[0]?.[1]).toBe(-1);
  });

  it('enters deep water at the given factor', () => {
    // given
    const grid = gridOf('.≈.');

    // when
    const distances = measureDistances(grid, [at(0, 0), at(2, 0)], {
      costs: { [Tile.DeepWater]: 10 },
    });

    // then
    expect(distances[0]?.[1]).toBe(11);
  });

  it('keeps the default of the tiles a cost was not given for', () => {
    // given
    const grid = gridOf('.#.');

    // when
    const distances = measureDistances(grid, [at(0, 0), at(2, 0)], {
      costs: { [Tile.DeepWater]: 10 },
    });

    // then
    expect(distances[0]?.[1]).toBe(-1);
  });

  it('takes a cheaper way over a factor below 1', () => {
    // given
    const grid = gridOf('.....', '=====');

    // when
    const distances = measureDistances(grid, [at(0, 0), at(4, 0)], {
      costs: { [Tile.Road]: 0.25 },
      metric: 'manhattan',
    });

    // then
    expect(distances[0]?.[1]).toBe(2.25);
  });

  it('charges the tile a walk enters, so the way back may differ', () => {
    // given
    const grid = gridOf('.=');

    // when
    const distances = measureDistances(grid, [at(0, 0), at(1, 0)], {
      costs: { [Tile.Road]: 0.5 },
    });

    // then
    expect(distances).toEqual([
      [0, 0.5],
      [1, 0],
    ]);
  });

  it('leaves out the tiles of a place that cannot be entered', () => {
    // given
    const grid = gridOf('#...');

    // when
    const distances = measureDistances(grid, [
      [
        { x: 0, y: 0 },
        { x: 1, y: 0 },
      ],
      at(3, 0),
    ]);

    // then
    expect(distances).toEqual([
      [0, 2],
      [2, 0],
    ]);
  });

  it('gives -1 everywhere for a place with no tile that can be entered', () => {
    // given
    const grid = gridOf('#..');

    // when
    const distances = measureDistances(grid, [at(0, 0), at(2, 0)]);

    // then
    expect(distances).toEqual([
      [-1, -1],
      [-1, 0],
    ]);
  });

  it('returns an empty matrix for no places', () => {
    // given
    const grid = gridOf('...');

    // when
    const distances = measureDistances(grid, []);

    // then
    expect(distances).toEqual([]);
  });

  it.each([0, -1, Number.NaN])('rejects a factor of %s', (factor) => {
    // given
    const grid = gridOf('...');

    // when
    const measure = () =>
      measureDistances(grid, [at(0, 0)], { costs: { [Tile.Floor]: factor } });

    // then
    expect(measure).toThrow(RangeError);
  });

  it('rejects a cost for an unknown tile', () => {
    // given
    const grid = gridOf('...');
    const costs = { 42: 1 } as Partial<Record<Tile, number>>;

    // when
    const measure = () => measureDistances(grid, [at(0, 0)], { costs });

    // then
    expect(measure).toThrow(RangeError);
  });

  it('rejects an unknown metric', () => {
    // given
    const grid = gridOf('...');

    // when
    const measure = () =>
      measureDistances(grid, [at(0, 0)], {
        metric: 'taxicab' as 'manhattan',
      });

    // then
    expect(measure).toThrow(RangeError);
  });

  it('rejects a tile outside the grid', () => {
    // given
    const grid = gridOf('...');

    // when
    const measure = () => measureDistances(grid, [at(3, 0)]);

    // then
    expect(measure).toThrow(RangeError);
  });
});
