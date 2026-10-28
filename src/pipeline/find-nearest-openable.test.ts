import { describe, expect, it } from 'vitest';
import { Tile } from '../core/tile';
import { emptyMap } from './empty-map';
import { findNearestOpenable } from './find-nearest-openable';
import { Reserve } from './reserve';
import { reserveTile } from './reserve-tile';

function wallMap() {
  return emptyMap({ width: 20, height: 10, tile: Tile.Wall })();
}

describe('findNearestOpenable', () => {
  it('finds the nearest openable tile and the free tile it is reached from', () => {
    // given
    const state = wallMap();
    reserveTile(state, 10, 5, Reserve.Openable);
    reserveTile(state, 15, 5, Reserve.Openable);

    // when
    const found = findNearestOpenable(state, [{ x: 13, y: 5 }]);

    // then
    expect(found).toEqual({
      openable: { x: 15, y: 5 },
      outside: { x: 14, y: 5 },
      direction: 3,
      start: 0,
    });
  });

  it('says which start it came from', () => {
    // given
    const state = wallMap();
    reserveTile(state, 10, 5, Reserve.Openable);

    // when
    const found = findNearestOpenable(state, [
      { x: 2, y: 2 },
      { x: 10, y: 8 },
    ]);

    // then
    expect(found?.start).toBe(1);
    expect(found?.direction).toBe(2);
  });

  it('goes round reserved and blocked tiles, and never diagonally', () => {
    // given
    const state = wallMap();
    reserveTile(state, 10, 5, Reserve.Openable);
    reserveTile(state, 11, 5, Reserve.Solid);
    const blocked = new Uint8Array(20 * 10);
    blocked[4 * 20 + 10] = 1;

    // when
    const found = findNearestOpenable(state, [{ x: 12, y: 5 }], { blocked });

    // then
    expect(found?.outside).toEqual({ x: 10, y: 6 });
  });

  it('passes over the openable tiles that accepts turns down', () => {
    // given
    const state = wallMap();
    reserveTile(state, 6, 5, Reserve.Openable);
    reserveTile(state, 2, 5, Reserve.Openable);

    // when
    const found = findNearestOpenable(state, [{ x: 7, y: 5 }], {
      accepts: ({ x }) => x < 5,
    });

    // then
    expect(found?.openable).toEqual({ x: 2, y: 5 });
  });

  it('returns undefined when no openable tile can be reached', () => {
    // given
    const state = wallMap();
    reserveTile(state, 10, 5, Reserve.Openable);
    for (const [x, y] of [
      [1, 0],
      [0, 1],
      [1, 1],
    ]) {
      reserveTile(state, x as number, y as number, Reserve.Solid);
    }

    // when
    const found = findNearestOpenable(state, [{ x: 0, y: 0 }]);

    // then
    expect(found).toBeUndefined();
  });
});
