import { describe, expect, it } from 'vitest';
import { Tile } from '../core/tile';
import { emptyMap } from './empty-map';
import { stampTile } from './stamp-tile';

describe('stampTile', () => {
  it('sets the tile', () => {
    // given
    const state = emptyMap({ width: 3, height: 3, tile: Tile.Grass })();

    // when
    stampTile(state, 2, 1, Tile.Road);

    // then
    expect(state.grid.get(2, 1)).toBe(Tile.Road);
  });

  it('clears the prunable byte of that tile only', () => {
    // given
    const state = emptyMap({ width: 3, height: 3, tile: Tile.Grass })();
    state.prunable.fill(1);

    // when
    stampTile(state, 2, 1, Tile.Road);

    // then
    expect(state.prunable[1 * 3 + 2]).toBe(0);
    expect(state.prunable.reduce((sum, byte) => sum + byte, 0)).toBe(8);
  });

  it('throws a RangeError outside the grid', () => {
    // given
    const state = emptyMap({ width: 3, height: 3, tile: Tile.Grass })();

    // when
    const call = () => {
      stampTile(state, 3, 0, Tile.Road);
    };

    // then
    expect(call).toThrow(RangeError);
  });
});
