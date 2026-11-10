import { describe, expect, it } from 'vitest';
import { Tile } from '../core/tile';
import { emptyMap } from '../pipeline/empty-map';
import { Reserve } from '../pipeline/reserve';
import { reserveTile } from '../pipeline/reserve-tile';
import { joinAcrossApproaches } from './join-across-approaches';

/**
 * A wall map of 12 by 7 with a corridor from (1, 3) to (3, 3), shut by an
 * `Openable` entrance at (4, 3), and a strip of floor in column `far` from
 * row 1 to row 5.
 */
function entranceMap(far: number) {
  const state = emptyMap({ width: 12, height: 7, tile: Tile.Wall })();
  for (let x = 1; x <= 3; ++x) {
    state.grid.set(x, 3, Tile.Floor);
  }
  for (let y = 1; y <= 5; ++y) {
    state.grid.set(far, y, Tile.Floor);
  }
  reserveTile(state, 4, 3, Reserve.Openable);
  return state;
}

describe('joinAcrossApproaches', () => {
  it('opens an entrance and digs the tile beyond it, when floor is right past that', () => {
    // given
    const state = entranceMap(6);

    // when
    const opened = joinAcrossApproaches(state);

    // then
    expect(opened).toEqual([{ x: 4, y: 3 }]);
    expect([state.grid.get(4, 3), state.grid.get(5, 3)]).toEqual([
      Tile.Floor,
      Tile.Floor,
    ]);
    expect(state.reserved[3 * 12 + 4]).toBe(Reserve.Solid);
  });

  it('digs two tiles out when the second touches the other floor', () => {
    // given
    const state = entranceMap(7);

    // when
    const opened = joinAcrossApproaches(state);

    // then
    expect(opened).toEqual([{ x: 4, y: 3 }]);
    expect([state.grid.get(5, 3), state.grid.get(6, 3)]).toEqual([
      Tile.Floor,
      Tile.Floor,
    ]);
  });

  it('leaves an entrance alone when the other floor is farther out', () => {
    // given
    const state = entranceMap(8);

    // when
    const opened = joinAcrossApproaches(state);

    // then
    expect(opened).toEqual([]);
    expect(state.grid.get(5, 3)).toBe(Tile.Wall);
  });

  it('leaves an entrance alone when the tile beyond it is not free', () => {
    // given
    const state = entranceMap(6);
    reserveTile(state, 5, 3, Reserve.Solid);

    // when
    const opened = joinAcrossApproaches(state);

    // then
    expect(opened).toEqual([]);
  });

  it('leaves a wall that skip marks alone', () => {
    // given
    const state = entranceMap(6);
    const skip = new Uint8Array(12 * 7);
    skip[3 * 12 + 4] = 1;

    // when
    const opened = joinAcrossApproaches(state, skip);

    // then
    expect(opened).toEqual([]);
  });

  it('leaves an entrance alone when the floor beyond is the same piece', () => {
    // given
    const state = entranceMap(6);
    for (let x = 1; x <= 6; ++x) {
      state.grid.set(x, 1, Tile.Floor);
    }
    for (let y = 1; y <= 3; ++y) {
      state.grid.set(1, y, Tile.Floor);
    }

    // when
    const opened = joinAcrossApproaches(state);

    // then
    expect(opened).toEqual([]);
  });
});
