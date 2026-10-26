import { describe, expect, it } from 'vitest';
import { findLandPath } from './find-land-path';

describe('findLandPath', () => {
  it('goes round a blocked wall by the shortest way', () => {
    // given
    const blocked = new Uint8Array(25);
    for (let y = 0; y < 4; ++y) {
      blocked[y * 5 + 2] = 1;
    }

    // when
    const path = findLandPath({ x: 0, y: 0 }, { x: 4, y: 0 }, blocked, 5, 5);

    // then
    expect(path).toHaveLength(13);
    expect(path?.some(({ x, y }) => x === 2 && y < 4)).toBe(false);
  });

  it('finds no path when the tile is walled in', () => {
    // given
    const blocked = new Uint8Array(25);
    for (let y = 0; y < 5; ++y) {
      blocked[y * 5 + 2] = 1;
    }

    // when
    const path = findLandPath({ x: 0, y: 0 }, { x: 4, y: 0 }, blocked, 5, 5);

    // then
    expect(path).toBeUndefined();
  });
});
