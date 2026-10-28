import { describe, expect, it } from 'vitest';
import { carveDirectTunnel } from './carve-direct-tunnel';
import { Grid } from '../core/grid';
import { Tile } from '../core/tile';

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

  it('takes the other bend when blocked tiles stand in the way of the first', () => {
    // given
    const grid = new Grid(10, 8);
    const blocked = new Uint8Array(10 * 8);
    blocked[2 * 10 + 4] = 1;

    // when
    carveDirectTunnel(
      grid,
      () => 0,
      { x: 2, y: 2 },
      { x: 5, y: 5 },
      {
        ...OPTIONS,
        blocked,
      },
    );

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

  it('walks round blocked tiles that stand in the way of both bends', () => {
    // given
    const grid = new Grid(12, 8);
    const blocked = new Uint8Array(12 * 8);
    for (let y = 0; y < 6; ++y) {
      blocked[y * 12 + 5] = 1;
    }

    // when
    carveDirectTunnel(
      grid,
      () => 0,
      { x: 2, y: 2 },
      { x: 8, y: 2 },
      {
        ...OPTIONS,
        blocked,
      },
    );

    // then
    expect(floors(grid)).toContain('5,6');
    expect(
      floors(grid).some((tile) => tile.startsWith('5,') && tile !== '5,6'),
    ).toBe(false);
    expect(floors(grid)).toContain('8,2');
  });

  it('carves nothing when blocked tiles shut the goal off', () => {
    // given
    const grid = new Grid(12, 8);
    const blocked = new Uint8Array(12 * 8);
    for (let y = 0; y < 8; ++y) {
      blocked[y * 12 + 5] = 1;
    }

    // when
    carveDirectTunnel(
      grid,
      () => 0,
      { x: 2, y: 2 },
      { x: 8, y: 2 },
      {
        ...OPTIONS,
        blocked,
      },
    );

    // then
    expect(floors(grid)).toEqual([]);
  });
});
