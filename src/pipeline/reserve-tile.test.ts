import { describe, expect, it } from 'vitest';
import { Tile } from '../core/tile';
import { emptyMap } from './empty-map';
import { Reserve } from './reserve';
import { reserveTile } from './reserve-tile';

describe('reserveTile', () => {
  it.each([Reserve.Solid, Reserve.Openable])(
    'sets the kind %i on that tile only',
    (kind) => {
      // given
      const state = emptyMap({ width: 3, height: 3, tile: Tile.Wall })();

      // when
      reserveTile(state, 2, 1, kind);

      // then
      expect(state.reserved[1 * 3 + 2]).toBe(kind);
      expect(state.reserved.reduce((sum, byte) => sum + byte, 0)).toBe(kind);
    },
  );

  it('leaves the tile and its prunable byte alone', () => {
    // given
    const state = emptyMap({ width: 3, height: 3, tile: Tile.Grass })();
    state.prunable.fill(1);

    // when
    reserveTile(state, 1, 1, Reserve.Solid);

    // then
    expect(state.grid.get(1, 1)).toBe(Tile.Grass);
    expect(state.prunable[4]).toBe(1);
  });

  it('throws a RangeError outside the grid', () => {
    // given
    const state = emptyMap({ width: 3, height: 3, tile: Tile.Wall })();

    // when
    const call = () => {
      reserveTile(state, 3, 0, Reserve.Solid);
    };

    // then
    expect(call).toThrow(RangeError);
  });
});
