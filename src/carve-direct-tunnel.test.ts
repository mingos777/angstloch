import { describe, expect, it } from 'vitest';
import { carveDirectTunnel } from './carve-direct-tunnel';
import { Grid } from './grid';
import { Tile } from './tile';

const OPTIONS = {
  style: 'direct',
  width: 1,
  windiness: 0,
  borderWalls: true,
} as const;

function floors(grid: Grid) {
  const result: string[] = [];
  for (let y = 0; y < grid.height; ++y) {
    for (let x = 0; x < grid.width; ++x) {
      if (grid.get(x, y) === Tile.Floor) {
        result.push(`${String(x)},${String(y)}`);
      }
    }
  }
  return result;
}

describe('carveDirectTunnel', () => {
  it('carves a straight line between aligned positions', () => {
    // given
    const grid = new Grid(10, 5);

    // when
    carveDirectTunnel(grid, () => 0, { x: 2, y: 2 }, { x: 6, y: 2 }, OPTIONS);

    // then
    expect(floors(grid)).toEqual(['2,2', '3,2', '4,2', '5,2', '6,2']);
  });

  it('carves a single bend horizontal first', () => {
    // given
    const grid = new Grid(10, 8);

    // when
    carveDirectTunnel(grid, () => 0, { x: 2, y: 2 }, { x: 5, y: 5 }, OPTIONS);

    // then
    expect(floors(grid)).toEqual([
      '2,2',
      '3,2',
      '4,2',
      '5,2',
      '5,3',
      '5,4',
      '5,5',
    ]);
  });

  it('carves a single bend vertical first', () => {
    // given
    const grid = new Grid(10, 8);

    // when
    carveDirectTunnel(grid, () => 0.9, { x: 2, y: 2 }, { x: 5, y: 5 }, OPTIONS);

    // then
    expect(floors(grid)).toEqual([
      '2,2',
      '2,3',
      '2,4',
      '2,5',
      '3,5',
      '4,5',
      '5,5',
    ]);
  });

  it('carves a wider tunnel with the width', () => {
    // given
    const grid = new Grid(12, 8);

    // when
    carveDirectTunnel(
      grid,
      () => 0,
      { x: 3, y: 3 },
      { x: 7, y: 3 },
      {
        ...OPTIONS,
        width: 3,
      },
    );

    // then
    expect(floors(grid)).toHaveLength(7 * 3);
  });

  it('leaves the border alone with borderWalls', () => {
    // given
    const grid = new Grid(6, 6);

    // when
    carveDirectTunnel(
      grid,
      () => 0,
      { x: 1, y: 1 },
      { x: 4, y: 1 },
      {
        ...OPTIONS,
        width: 3,
      },
    );

    // then
    expect(grid.get(2, 0)).toBe(Tile.Wall);
  });
});
