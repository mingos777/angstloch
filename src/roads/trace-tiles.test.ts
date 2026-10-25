import { describe, expect, it } from 'vitest';
import { traceTiles } from './trace-tiles';

describe('traceTiles', () => {
  it('returns the single tile when both ends are the same', () => {
    // given
    const tile = { x: 3, y: 4 };

    // when
    const tiles = traceTiles(tile, tile);

    // then
    expect(tiles).toEqual([tile]);
  });

  it('traces a horizontal line', () => {
    // given
    const from = { x: 1, y: 2 };
    const to = { x: 4, y: 2 };

    // when
    const tiles = traceTiles(from, to);

    // then
    expect(tiles).toEqual([
      { x: 1, y: 2 },
      { x: 2, y: 2 },
      { x: 3, y: 2 },
      { x: 4, y: 2 },
    ]);
  });

  it('traces a vertical line upwards', () => {
    // given
    const from = { x: 2, y: 5 };
    const to = { x: 2, y: 3 };

    // when
    const tiles = traceTiles(from, to);

    // then
    expect(tiles).toEqual([
      { x: 2, y: 5 },
      { x: 2, y: 4 },
      { x: 2, y: 3 },
    ]);
  });

  it.each([
    [
      { x: 0, y: 0 },
      { x: 7, y: 3 },
    ],
    [
      { x: 9, y: 2 },
      { x: 1, y: 8 },
    ],
    [
      { x: 3, y: 3 },
      { x: 8, y: 8 },
    ],
    [
      { x: 5, y: 9 },
      { x: 4, y: 0 },
    ],
  ])('never steps diagonally from %j to %j', (from, to) => {
    // given
    const tiles = traceTiles(from, to);

    // when
    const steps = tiles
      .slice(1)
      .map(
        (tile, i) =>
          Math.abs(tile.x - (tiles[i]?.x ?? 0)) +
          Math.abs(tile.y - (tiles[i]?.y ?? 0)),
      );

    // then
    expect(tiles[0]).toEqual(from);
    expect(tiles[tiles.length - 1]).toEqual(to);
    expect(steps.every((step) => step === 1)).toBe(true);
  });

  it('uses the fewest tiles possible', () => {
    // given
    const from = { x: 0, y: 0 };
    const to = { x: 7, y: 3 };

    // when
    const tiles = traceTiles(from, to);

    // then
    expect(tiles).toHaveLength(7 + 3 + 1);
  });
});
