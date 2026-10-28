import { describe, expect, it } from 'vitest';
import { Grid } from '../core/grid';
import { findTunnelPath } from './find-tunnel-path';

/** A mask of a 9 by 7 map with a wall at x = 4 from y = 0 to y = 4. */
function wall(): Uint8Array {
  const blocked = new Uint8Array(9 * 7);
  for (let y = 0; y <= 4; ++y) {
    blocked[y * 9 + 4] = 1;
  }
  return blocked;
}

describe('findTunnelPath', () => {
  it('walks straight when nothing is in the way', () => {
    // given
    const grid = new Grid(9, 7);

    // when
    const path = findTunnelPath(
      grid,
      { x: 1, y: 3 },
      { x: 4, y: 3 },
      {
        borderWalls: true,
      },
    );

    // then
    expect(path).toEqual([
      { x: 1, y: 3 },
      { x: 2, y: 3 },
      { x: 3, y: 3 },
      { x: 4, y: 3 },
    ]);
  });

  it('walks round the blocked tiles by the shortest way', () => {
    // given
    const grid = new Grid(9, 7);

    // when
    const path = findTunnelPath(
      grid,
      { x: 2, y: 1 },
      { x: 6, y: 1 },
      {
        borderWalls: true,
        blocked: wall(),
      },
    );

    // then
    expect(path).toHaveLength(13);
    expect(path?.some(({ x, y }) => x === 4 && y <= 4)).toBe(false);
  });

  it('finds no walk when the only way is the border ring', () => {
    // given
    const grid = new Grid(9, 7);
    const blocked = wall();
    blocked[5 * 9 + 4] = 1;

    // when
    const shut = findTunnelPath(
      grid,
      { x: 2, y: 1 },
      { x: 6, y: 1 },
      {
        borderWalls: true,
        blocked,
      },
    );
    const open = findTunnelPath(
      grid,
      { x: 2, y: 1 },
      { x: 6, y: 1 },
      {
        borderWalls: false,
        blocked,
      },
    );

    // then
    expect(shut).toBeUndefined();
    expect(open?.at(-1)).toEqual({ x: 6, y: 1 });
  });
});
