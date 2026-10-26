import { describe, expect, it } from 'vitest';
import { dilateMask } from './dilate-mask';

describe('dilateMask', () => {
  it('grows a tile into a square', () => {
    // given
    const mask = new Uint8Array(49);
    mask[3 * 7 + 3] = 1;

    // when
    const grown = dilateMask(mask, 7, 7, 2);

    // then
    expect(grown.reduce((a, b) => a + b, 0)).toBe(25);
  });

  it('stops at the edge of the map', () => {
    // given
    const mask = new Uint8Array(49);
    mask[0] = 1;

    // when
    const grown = dilateMask(mask, 7, 7, 2);

    // then
    expect(grown.reduce((a, b) => a + b, 0)).toBe(9);
  });
});
