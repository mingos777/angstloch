import { describe, expect, it } from 'vitest';
import type { Area } from '../core/area';
import { Tile } from '../core/tile';
import { mulberry32 } from '../test-helpers/mulberry32';
import { emptyMap } from './empty-map';
import { placeAreas } from './place-areas';
import { Reserve } from './reserve';

const ONE = { min: 1, max: 1 };

function intersect(a: Area, b: Area): boolean {
  return (
    a.x < b.x + b.width &&
    b.x < a.x + a.width &&
    a.y < b.y + b.height &&
    b.y < a.y + a.height
  );
}

describe('placeAreas', () => {
  it('takes the whole map by default', () => {
    // given
    const state = emptyMap({ width: 40, height: 30, tile: Tile.Wall })();

    // when
    const boxes = placeAreas(state, mulberry32(1), {}, ONE);

    // then
    expect(boxes).toEqual([{ x: 0, y: 0, width: 40, height: 30 }]);
  });

  it('returns as many boxes as the count says', () => {
    // given
    const state = emptyMap({ width: 80, height: 50, tile: Tile.Wall })();
    const area = { width: { min: 10, max: 10 }, height: { min: 8, max: 8 } };

    // when
    const boxes = placeAreas(state, mulberry32(1), area, { min: 3, max: 3 });

    // then
    expect(boxes).toHaveLength(3);
  });

  it('draws the sizes from the ranges and keeps the box on the map', () => {
    // given
    const state = emptyMap({ width: 40, height: 30, tile: Tile.Wall })();
    const area = { width: { min: 5, max: 12 }, height: { min: 6, max: 9 } };

    // when
    const boxes = Array.from({ length: 30 }, (_, seed) =>
      placeAreas(state, mulberry32(seed), area, ONE),
    ).flat();

    // then
    for (const { x, y, width, height } of boxes) {
      expect(width).toBeGreaterThanOrEqual(5);
      expect(width).toBeLessThanOrEqual(12);
      expect(height).toBeGreaterThanOrEqual(6);
      expect(height).toBeLessThanOrEqual(9);
      expect(x).toBeGreaterThanOrEqual(0);
      expect(y).toBeGreaterThanOrEqual(0);
      expect(x + width).toBeLessThanOrEqual(40);
      expect(y + height).toBeLessThanOrEqual(30);
    }
  });

  it('leaves a tile between boxes', () => {
    // given
    const state = emptyMap({ width: 30, height: 12, tile: Tile.Wall })();
    const area = { width: { min: 10, max: 10 }, height: { min: 12, max: 12 } };

    // when
    const boxes = Array.from({ length: 30 }, (_, seed) =>
      placeAreas(state, mulberry32(seed), area, { min: 2, max: 2 }),
    );

    // then
    for (const [first, second] of boxes) {
      expect(first).toBeDefined();
      expect(second).toBeDefined();
      const grown = {
        x: (first?.x ?? 0) - 1,
        y: (first?.y ?? 0) - 1,
        width: (first?.width ?? 0) + 2,
        height: (first?.height ?? 0) + 2,
      };
      expect(intersect(grown, second as Area)).toBe(false);
    }
  });

  it('keeps off tiles that are not free, and leaves a margin of one free tile', () => {
    // given
    const state = emptyMap({ width: 30, height: 10, tile: Tile.Wall })();
    for (let y = 0; y < 10; ++y) {
      state.grid.set(15, y, Tile.Floor);
    }
    const area = { width: { min: 5, max: 5 }, height: { min: 5, max: 5 } };

    // when
    const boxes = Array.from({ length: 40 }, (_, seed) =>
      placeAreas(state, mulberry32(seed), area, ONE),
    ).flat();

    // then
    for (const { x, width } of boxes) {
      expect(x + width + 1 <= 15 || x - 1 >= 16).toBe(true);
    }
  });

  it('keeps off reserved tiles', () => {
    // given
    const state = emptyMap({ width: 30, height: 10, tile: Tile.Wall })();
    for (let y = 0; y < 10; ++y) {
      state.reserved.fill(Reserve.Solid, y * 30, y * 30 + 14);
    }
    const area = { width: { min: 5, max: 5 }, height: { min: 5, max: 5 } };

    // when
    const boxes = Array.from({ length: 20 }, (_, seed) =>
      placeAreas(state, mulberry32(seed), area, ONE),
    ).flat();

    // then
    for (const { x } of boxes) {
      expect(x).toBeGreaterThanOrEqual(15);
    }
  });

  it('throws an ordinary Error when there is no free spot', () => {
    // given
    const state = emptyMap({ width: 30, height: 10, tile: Tile.Wall })();
    state.reserved.fill(Reserve.Solid);
    const area = { width: { min: 5, max: 5 }, height: { min: 5, max: 5 } };

    // when
    const call = () => placeAreas(state, mulberry32(1), area, ONE);

    // then
    expect(call).toThrow(/No free spot.*make the area smaller/);
    expect(call).not.toThrow(RangeError);
  });

  it('puts a box over anything with overlap', () => {
    // given
    const state = emptyMap({ width: 30, height: 10, tile: Tile.Wall })();
    state.reserved.fill(Reserve.Solid);
    const area = { width: { min: 5, max: 5 }, height: { min: 5, max: 5 } };

    // when
    const boxes = placeAreas(state, mulberry32(1), area, ONE, {
      overlap: true,
    });

    // then
    expect(boxes).toHaveLength(1);
  });

  it('keeps the boxes apart from each other with overlap', () => {
    // given
    const state = emptyMap({ width: 80, height: 50, tile: Tile.Wall })();
    state.reserved.fill(Reserve.Solid);
    const area = { width: { min: 10, max: 10 }, height: { min: 8, max: 8 } };

    // when
    const boxes = placeAreas(
      state,
      mulberry32(1),
      area,
      { min: 4, max: 4 },
      {
        overlap: true,
      },
    );

    // then
    for (const [i, a] of boxes.entries()) {
      for (const b of boxes.slice(i + 1)) {
        expect(intersect(a, b)).toBe(false);
      }
    }
  });

  it('draws a count from its range', () => {
    // given
    const state = emptyMap({ width: 80, height: 50, tile: Tile.Wall })();
    const area = { width: { min: 5, max: 5 }, height: { min: 5, max: 5 } };

    // when
    const counts = new Set(
      Array.from(
        { length: 40 },
        (_, seed) =>
          placeAreas(state, mulberry32(seed), area, { min: 0, max: 2 }).length,
      ),
    );

    // then
    expect([...counts].sort()).toEqual([0, 1, 2]);
  });

  describe('on a lattice', () => {
    it('gives boxes odd sizes that start on even coordinates', () => {
      // given
      const state = emptyMap({ width: 41, height: 31, tile: Tile.Wall })();
      const area = { width: { min: 4, max: 12 }, height: { min: 4, max: 12 } };

      // when
      const boxes = Array.from({ length: 40 }, (_, seed) =>
        placeAreas(state, mulberry32(seed), area, ONE, { lattice: true }),
      ).flat();

      // then
      for (const { x, y, width, height } of boxes) {
        expect(x % 2).toBe(0);
        expect(y % 2).toBe(0);
        expect(width % 2).toBe(1);
        expect(height % 2).toBe(1);
      }
    });

    it('takes a whole odd map as it is', () => {
      // given
      const state = emptyMap({ width: 41, height: 31, tile: Tile.Wall })();

      // when
      const boxes = placeAreas(state, mulberry32(1), {}, ONE, {
        lattice: true,
      });

      // then
      expect(boxes).toEqual([{ x: 0, y: 0, width: 41, height: 31 }]);
    });

    it('keeps an odd size of 1 when the range starts at 1', () => {
      // given
      const state = emptyMap({ width: 41, height: 31, tile: Tile.Wall })();
      const area = { width: { min: 2, max: 2 }, height: { min: 1, max: 1 } };

      // when
      const [box] = placeAreas(state, mulberry32(1), area, ONE, {
        lattice: true,
      });

      // then
      expect(box?.width).toBe(3);
      expect(box?.height).toBe(1);
    });
  });
});
