import { describe, expect, it } from 'vitest';
import { findBridges } from './find-bridges';

/** A map of 12 by 12 tiles with the given boxes, `[x, y, width, height]`, set to 1. */
function paint(boxes: [number, number, number, number][]): Uint8Array {
  const tiles = new Uint8Array(12 * 12);
  for (const [x, y, width, height] of boxes) {
    for (let j = y; j < y + height; ++j) {
      tiles.fill(1, j * 12 + x, j * 12 + x + width);
    }
  }
  return tiles;
}

describe('findBridges', () => {
  it('finds a bridge where a road crosses water', () => {
    // given
    const water = paint([[0, 4, 12, 3]]);
    const road = paint([[5, 0, 3, 12]]);

    // when
    const bridges = findBridges(water, road, 12, 12);

    // then
    expect(bridges).toEqual([{ x: 6, y: 5 }]);
  });

  it('finds one bridge for every crossing', () => {
    // given
    const water = paint([[0, 4, 12, 3]]);
    const road = paint([
      [1, 0, 2, 12],
      [8, 0, 2, 12],
    ]);

    // when
    const bridges = findBridges(water, road, 12, 12);

    // then
    expect(bridges).toHaveLength(2);
  });

  it('finds none where road and water do not meet', () => {
    // given
    const water = paint([[0, 1, 12, 2]]);
    const road = paint([[0, 8, 12, 2]]);

    // when
    const bridges = findBridges(water, road, 12, 12);

    // then
    expect(bridges).toEqual([]);
  });
});
