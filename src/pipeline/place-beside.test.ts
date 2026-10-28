import { describe, expect, it } from 'vitest';
import type { Point } from '../core/point';
import { Tile } from '../core/tile';
import { mulberry32 } from '../test-helpers/mulberry32';
import { emptyMap } from './empty-map';
import { placeBeside } from './place-beside';
import { Reserve } from './reserve';

/** A 3 by 3 block of floor in the middle of a 5 by 5 box. */
const SIZE = { width: 5, height: 5 };
const BLOCK: Point[] = [1, 2, 3].flatMap((y) =>
  [1, 2, 3].map((x) => ({ x, y })),
);

/** A wall map with a column of floor at `x`, from top to bottom. */
function withColumn(x: number) {
  const state = emptyMap({ width: 40, height: 20, tile: Tile.Wall })();
  for (let y = 0; y < 20; ++y) {
    state.grid.set(x, y, Tile.Floor);
  }
  return state;
}

describe('placeBeside', () => {
  it('puts the shape on the map on a map with nothing dug', () => {
    // given
    const state = emptyMap({ width: 40, height: 20, tile: Tile.Wall })();

    // when
    const box = placeBeside(state, mulberry32(1), SIZE, BLOCK);

    // then
    expect(box).toMatchObject(SIZE);
    expect(box?.x).toBeGreaterThanOrEqual(0);
    expect((box?.x ?? 0) + 5).toBeLessThanOrEqual(40);
  });

  it('keeps a wall between the floor of the shape and the dug ground', () => {
    // given
    const state = withColumn(20);

    // when
    const boxes = Array.from({ length: 20 }, (_, seed) =>
      placeBeside(state, mulberry32(seed), SIZE, BLOCK),
    );

    // then
    for (const box of boxes) {
      const left = (box?.x ?? 0) + 1;
      expect(left + 3 < 20 || left - 1 > 20).toBe(true);
    }
  });

  it('lets the box overlap the dug ground where the floor does not', () => {
    // given
    const state = withColumn(20);
    // the floor fills the left of a box that has rock to its right
    const wide = { width: 9, height: 5 };

    // when
    const boxes = Array.from({ length: 40 }, (_, seed) =>
      placeBeside(state, mulberry32(seed), wide, BLOCK),
    );

    // then
    expect(
      boxes.some((box) => box && box.x <= 20 && box.x + box.width > 20),
    ).toBe(true);
  });

  it('puts the shape as near the dug ground as it finds', () => {
    // given
    const state = withColumn(20);

    // when
    const gaps = Array.from({ length: 10 }, (_, seed) => {
      const box = placeBeside(state, mulberry32(seed), SIZE, BLOCK);
      const left = (box?.x ?? 0) + 1;
      return Math.min(Math.abs(left - 20), Math.abs(left + 2 - 20));
    });

    // then
    expect(Math.max(...gaps)).toBeLessThanOrEqual(3);
  });

  it('keeps the floor of the shape a tile away from reserved tiles', () => {
    // given
    const state = emptyMap({ width: 40, height: 20, tile: Tile.Wall })();
    for (let y = 0; y < 20; ++y) {
      state.reserved.fill(Reserve.Solid, y * 40, y * 40 + 30);
    }

    // when
    const boxes = Array.from({ length: 10 }, (_, seed) =>
      placeBeside(state, mulberry32(seed), SIZE, BLOCK),
    );

    // then
    for (const box of boxes) {
      expect(box?.x).toBeGreaterThanOrEqual(30);
    }
  });

  it('finds no spot when every tile is taken', () => {
    // given
    const state = emptyMap({ width: 40, height: 20, tile: Tile.Wall })();
    state.reserved.fill(Reserve.Solid);

    // when
    const box = placeBeside(state, mulberry32(1), SIZE, BLOCK);

    // then
    expect(box).toBeUndefined();
  });
});
