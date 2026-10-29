import { describe, expect, it } from 'vitest';
import { Tile } from '../core/tile';
import { emptyMap } from './empty-map';
import { openReserved } from './open-reserved';
import { Reserve } from './reserve';

describe('openReserved', () => {
  it('turns the tile and the openable tiles around it, diagonals included, solid', () => {
    // given
    const state = emptyMap({ width: 5, height: 3, tile: Tile.Wall })();
    state.reserved.fill(Reserve.Openable);

    // when
    openReserved(state, 1, 1);

    // then
    expect(Array.from(state.reserved)).toEqual([
      1, 1, 1, 2, 2, 1, 1, 1, 2, 2, 1, 1, 1, 2, 2,
    ]);
  });

  it('leaves free and solid neighbors as they are', () => {
    // given
    const state = emptyMap({ width: 3, height: 1, tile: Tile.Wall })();
    state.reserved[0] = Reserve.None;
    state.reserved[1] = Reserve.Openable;

    // when
    openReserved(state, 1, 0);

    // then
    expect(Array.from(state.reserved)).toEqual([0, 1, 0]);
  });

  it('works at the edge of the map', () => {
    // given
    const state = emptyMap({ width: 3, height: 3, tile: Tile.Wall })();
    state.reserved.fill(Reserve.Openable);

    // when
    openReserved(state, 0, 0);

    // then
    expect(state.reserved[0]).toBe(Reserve.Solid);
    expect(state.reserved[4]).toBe(Reserve.Solid);
    expect(state.reserved[8]).toBe(Reserve.Openable);
  });

  it('throws a RangeError outside the grid', () => {
    // given
    const state = emptyMap({ width: 3, height: 3, tile: Tile.Wall })();

    // when
    const call = () => {
      openReserved(state, -1, 0);
    };

    // then
    expect(call).toThrow(RangeError);
  });
});
