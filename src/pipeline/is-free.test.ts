import { describe, expect, it } from 'vitest';
import { Tile } from '../core/tile';
import { emptyMap } from './empty-map';
import { isFree } from './is-free';
import { Reserve } from './reserve';

describe('isFree', () => {
  it('is true for a tile that holds the base tile', () => {
    // given
    const state = emptyMap({ width: 3, height: 3, tile: Tile.Grass })();

    // when
    const free = isFree(state, 1, 1);

    // then
    expect(free).toBe(true);
  });

  it('is true for a prunable tile that holds something else', () => {
    // given
    const state = emptyMap({ width: 3, height: 3, tile: Tile.Grass })();
    state.grid.set(1, 1, Tile.Tree);
    state.prunable[4] = 1;

    // when
    const free = isFree(state, 1, 1);

    // then
    expect(free).toBe(true);
  });

  it('is false for a tile that was stamped and is not prunable', () => {
    // given
    const state = emptyMap({ width: 3, height: 3, tile: Tile.Grass })();
    state.grid.set(1, 1, Tile.Road);

    // when
    const free = isFree(state, 1, 1);

    // then
    expect(free).toBe(false);
  });

  it.each([Reserve.Solid, Reserve.Openable])(
    'is false for a reserved tile (kind %i), even one that holds the base tile',
    (kind) => {
      // given
      const state = emptyMap({ width: 3, height: 3, tile: Tile.Wall })();
      state.reserved[4] = kind;

      // when
      const free = isFree(state, 1, 1);

      // then
      expect(free).toBe(false);
    },
  );

  it('is false outside the grid', () => {
    // given
    const state = emptyMap({ width: 3, height: 3, tile: Tile.Grass })();

    // when
    const free = isFree(state, 3, 1);

    // then
    expect(free).toBe(false);
  });
});
