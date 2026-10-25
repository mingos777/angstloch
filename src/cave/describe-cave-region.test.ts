import { describe, expect, it } from 'vitest';
import { describeCaveRegion } from './describe-cave-region';

describe('describeCaveRegion', () => {
  it('counts the tiles', () => {
    // given
    const tiles = [
      { x: 2, y: 3 },
      { x: 3, y: 3 },
    ];

    // when
    const region = describeCaveRegion(tiles);

    // then
    expect(region.size).toBe(2);
  });

  it('reports the bounding rectangle', () => {
    // given
    const tiles = [
      { x: 2, y: 3 },
      { x: 3, y: 3 },
      { x: 3, y: 5 },
    ];

    // when
    const region = describeCaveRegion(tiles);

    // then
    expect(region.bounds).toEqual({ x: 2, y: 3, width: 2, height: 3 });
  });

  it('picks the tile nearest to the center of mass', () => {
    // given
    const tiles = [
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 2, y: 0 },
    ];

    // when
    const region = describeCaveRegion(tiles);

    // then
    expect(region.center).toEqual({ x: 1, y: 0 });
  });

  it('picks a floor tile when the center of mass is rock', () => {
    // given
    const ring = [
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 2, y: 0 },
      { x: 0, y: 1 },
      { x: 2, y: 1 },
      { x: 0, y: 2 },
      { x: 1, y: 2 },
      { x: 2, y: 2 },
    ];

    // when
    const region = describeCaveRegion(ring);

    // then
    expect(ring).toContainEqual(region.center);
  });
});
