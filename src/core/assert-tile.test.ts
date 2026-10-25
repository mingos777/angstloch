import { describe, expect, it } from 'vitest';
import { assertTile } from './assert-tile';
import { Tile } from './tile';

describe('assertTile', () => {
  it.each(Object.values(Tile))('accepts the tile %i', (tile) => {
    // given
    const assert = () => {
      assertTile('tile', tile);
    };

    // when / then
    expect(assert).not.toThrow();
  });

  it.each([-1, 6, 1.5, Number.NaN])('rejects %s', (value) => {
    // given
    const assert = () => {
      assertTile('tile', value);
    };

    // when / then
    expect(assert).toThrow(RangeError);
    expect(assert).toThrow('tile');
  });
});
