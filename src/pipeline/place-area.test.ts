import { describe, expect, it } from 'vitest';
import { Tile } from '../core/tile';
import { mulberry32 } from '../test-helpers/mulberry32';
import { emptyMap } from './empty-map';
import { placeArea } from './place-area';
import { Reserve } from './reserve';

const SIZE = { width: 5, height: 5 };

describe('placeArea', () => {
  it('returns undefined when no spot is found, instead of throwing', () => {
    // given
    const state = emptyMap({ width: 30, height: 10, tile: Tile.Wall })();
    state.reserved.fill(Reserve.Solid);

    // when
    const box = placeArea(state, mulberry32(1), SIZE, {}, []);

    // then
    expect(box).toBeUndefined();
  });

  it('keeps clear of the boxes taken before, with a tile between', () => {
    // given
    const state = emptyMap({ width: 30, height: 5, tile: Tile.Wall })();
    const taken = [{ x: 0, y: 0, width: 20, height: 5 }];

    // when
    const boxes = Array.from({ length: 20 }, (_, seed) =>
      placeArea(state, mulberry32(seed), SIZE, {}, taken, { overlap: true }),
    );

    // then
    for (const box of boxes) {
      expect(box?.x).toBeGreaterThanOrEqual(21);
    }
  });

  it('returns undefined for a box as big as the map that is not accepted', () => {
    // given
    const state = emptyMap({ width: 30, height: 10, tile: Tile.Wall })();

    // when
    const box = placeArea(
      state,
      mulberry32(1),
      { width: 30, height: 10 },
      {},
      [],
      { accepts: () => false },
    );

    // then
    expect(box).toBeUndefined();
  });
});
