import { describe, expect, it } from 'vitest';
import { carveCaveExit } from './carve-cave-exit';
import { Grid } from '../core/grid';
import { Tile } from '../core/tile';

/** A grid of walls with a floor block in the given columns and rows, inclusive. */
function withFloor(
  width: number,
  height: number,
  x: [number, number],
  y: [number, number],
) {
  const grid = new Grid(width, height);
  for (let ty = y[0]; ty <= y[1]; ++ty) {
    for (let tx = x[0]; tx <= x[1]; ++tx) {
      grid.set(tx, ty, Tile.Floor);
    }
  }
  return grid;
}

describe('carveCaveExit', () => {
  it('puts a door on the border', () => {
    // given
    const grid = withFloor(11, 9, [3, 7], [3, 5]);

    // when
    const exit = carveCaveExit(grid, Math.random, []);

    // then
    expect(exit).toBeDefined();
    const { x, y } = exit as { x: number; y: number };
    expect(x === 0 || y === 0 || x === 10 || y === 8).toBe(true);
    expect(grid.get(x, y)).toBe(Tile.Door);
  });

  it('digs a straight tunnel to the nearest floor', () => {
    // given
    const grid = withFloor(11, 9, [3, 7], [3, 5]);

    // when
    carveCaveExit(grid, () => 0, []);

    // then
    expect(grid.toString().split('\n')).toEqual([
      '###+#######',
      '###.#######',
      '###.#######',
      '###.....###',
      '###.....###',
      '###.....###',
      '###########',
      '###########',
      '###########',
    ]);
  });

  it('prefers the candidates with the shortest tunnels on a side', () => {
    // given
    const grid = new Grid(11, 9);
    grid.set(3, 2, Tile.Floor);
    grid.set(7, 6, Tile.Floor);

    // when
    const exit = carveCaveExit(grid, () => 0, []);

    // then
    expect(exit).toEqual({ x: 3, y: 0 });
    expect(grid.get(3, 1)).toBe(Tile.Floor);
  });

  it('turns a floor tile on the border into a door', () => {
    // given
    const grid = withFloor(7, 7, [0, 6], [0, 6]);

    // when
    const exit = carveCaveExit(grid, () => 0, []);

    // then
    expect(exit).toBeDefined();
    expect(grid.get((exit as { x: number }).x, (exit as { y: number }).y)).toBe(
      Tile.Door,
    );
  });

  it('keeps away from existing doors', () => {
    // given
    const grid = withFloor(11, 9, [1, 9], [1, 7]);
    const doors = [{ x: 1, y: 0 }];

    // when
    const exit = carveCaveExit(grid, () => 0, doors);

    // then
    expect(exit).toEqual({ x: 3, y: 0 });
  });

  it('never uses a corner', () => {
    // given
    const grid = withFloor(5, 5, [0, 4], [0, 4]);

    // when
    const exit = carveCaveExit(grid, () => 0, []);

    // then
    expect(exit).not.toEqual({ x: 0, y: 0 });
    expect(exit).not.toEqual({ x: 4, y: 0 });
  });

  it('returns nothing when there is no floor to reach', () => {
    // given
    const grid = new Grid(9, 9);

    // when
    const exit = carveCaveExit(grid, Math.random, []);

    // then
    expect(exit).toBeUndefined();
  });

  it('returns nothing on a map too small to have a border tile that is not a corner', () => {
    // given
    const grid = new Grid(2, 2, Tile.Floor);

    // when
    const exit = carveCaveExit(grid, Math.random, []);

    // then
    expect(exit).toBeUndefined();
  });
});
