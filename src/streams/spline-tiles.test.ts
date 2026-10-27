import { describe, expect, it } from 'vitest';
import { splineTiles } from './spline-tiles';

const POINTS = [
  { x: 0, y: 0 },
  { x: 10, y: 4 },
  { x: 20, y: 0 },
];

describe('splineTiles', () => {
  it('runs from the first point to the last', () => {
    // when
    const tiles = splineTiles(POINTS, 0, 0);

    // then
    expect(tiles[0]).toEqual({ x: 0, y: 0 });
    expect(tiles[tiles.length - 1]).toEqual({ x: 20, y: 0 });
  });

  it('passes through the points between', () => {
    // when
    const tiles = splineTiles(POINTS, 0, 0);

    // then
    expect(tiles).toContainEqual({ x: 10, y: 4 });
  });

  it('steps along edges only', () => {
    // when
    const tiles = splineTiles(POINTS, 0, 0);

    // then
    const jumps = tiles.filter(
      (tile, at) =>
        at > 0 &&
        Math.abs(tile.x - (tiles[at - 1]?.x ?? 0)) +
          Math.abs(tile.y - (tiles[at - 1]?.y ?? 0)) !==
          1,
    );
    expect(jumps).toEqual([]);
  });

  it('lays nothing without points', () => {
    // when
    const tiles = splineTiles([], 0, 0);

    // then
    expect(tiles).toEqual([]);
  });
});
