import { describe, expect, it } from 'vitest';
import { Grid } from '../core/grid';
import { Tile } from '../core/tile';
import { findReachableTargets } from './find-reachable-targets';

describe('findReachableTargets', () => {
  it('keeps the targets that a flood of free rock reaches', () => {
    // given
    const grid = new Grid(20, 10);
    for (let y = 0; y < 10; ++y) {
      grid.set(10, y, Tile.Floor);
    }
    const reserved = new Uint8Array(200);

    // when
    const reached = findReachableTargets(
      grid,
      reserved,
      [{ x: 5, y: 5 }],
      [{ x: 10, y: 5 }],
    );

    // then
    expect(reached).toEqual([{ x: 10, y: 5 }]);
  });

  it('drops a target that lies behind floor from the start', () => {
    // given
    const grid = new Grid(20, 10);
    for (let y = 0; y < 10; ++y) {
      grid.set(10, y, Tile.Floor);
    }
    const reserved = new Uint8Array(200);

    // when
    const reached = findReachableTargets(
      grid,
      reserved,
      [{ x: 5, y: 5 }],
      [{ x: 12, y: 5 }],
    );

    // then
    expect(reached).toEqual([]);
  });
});
