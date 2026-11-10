import { describe, expect, it } from 'vitest';
import { Grid } from '../core/grid';
import type { Point } from '../core/point';
import { Tile } from '../core/tile';
import { mulberry32 } from '../test-helpers/mulberry32';
import { planCrosscut } from './plan-crosscut';

const WIDTH = 20;
const HEIGHT = 20;

/** A column of tiles from `top` to `bottom`, both included. */
const column = (x: number, top: number, bottom: number): Point[] =>
  Array.from({ length: bottom - top + 1 }, (_, i) => ({ x, y: top + i }));

/** A map of rock with the tunnels dug in it, each owned by its index. */
function dig(tunnels: readonly Point[][]) {
  const grid = new Grid(WIDTH, HEIGHT, Tile.Wall);
  const owner = new Int32Array(WIDTH * HEIGHT).fill(-1);
  tunnels.forEach((tiles, passage) => {
    for (const { x, y } of tiles) {
      grid.set(x, y, Tile.Floor);
      owner[y * WIDTH + x] = passage;
    }
  });
  return { grid, owner };
}

describe('planCrosscut', () => {
  it('runs straight across between two parallel ribs, square to them', () => {
    // given
    const ribs = [column(5, 2, 17), column(10, 2, 17)];
    const { grid, owner } = dig(ribs);

    // when
    const line = planCrosscut(
      grid,
      mulberry32(1),
      owner,
      { tiles: ribs[0] ?? [], passage: 0 },
      { tiles: ribs[1] ?? [], passage: 1 },
      1,
    );

    // then
    const y = line?.[0]?.y;
    expect(line).toHaveLength(6);
    expect(line?.[0]?.x).toBe(5);
    expect(line?.[5]?.x).toBe(10);
    expect(line?.every((tile) => tile.y === y)).toBe(true);
    expect(y).toBeGreaterThan(2);
    expect(y).toBeLessThan(17);
  });

  it('keeps a wall between the crosscut and any other tunnel', () => {
    // given
    const ribs = [column(5, 2, 17), column(10, 2, 17)];
    const other = column(7, 2, 9);
    const { grid, owner } = dig([...ribs, other]);

    // when
    const line = planCrosscut(
      grid,
      mulberry32(1),
      owner,
      { tiles: ribs[0] ?? [], passage: 0 },
      { tiles: ribs[1] ?? [], passage: 1 },
      1,
    );

    // then
    expect(line?.[0]?.y).toBeGreaterThan(10);
  });

  it('digs no protected tile', () => {
    // given
    const ribs = [column(5, 2, 17), column(10, 2, 17)];
    const { grid, owner } = dig(ribs);
    const protect = new Uint8Array(WIDTH * HEIGHT);
    for (let y = 0; y < HEIGHT; ++y) {
      protect[y * WIDTH + 7] = 1;
    }

    // when
    const line = planCrosscut(
      grid,
      mulberry32(1),
      owner,
      { tiles: ribs[0] ?? [], passage: 0 },
      { tiles: ribs[1] ?? [], passage: 1 },
      1,
      protect,
    );

    // then
    expect(line).toBeUndefined();
  });

  it('finds nothing where the ribs do not run side by side', () => {
    // given
    const ribs = [column(5, 2, 8), column(10, 11, 17)];
    const { grid, owner } = dig(ribs);

    // when
    const line = planCrosscut(
      grid,
      mulberry32(1),
      owner,
      { tiles: ribs[0] ?? [], passage: 0 },
      { tiles: ribs[1] ?? [], passage: 1 },
      1,
    );

    // then
    expect(line).toBeUndefined();
  });
});
