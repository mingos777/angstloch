import { describe, expect, it } from 'vitest';
import type { Area } from '../core/area';
import type { AreaSpec } from './area-spec';
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

  describe('with a window', () => {
    const SEEDS = 40;

    function placeMany(
      area: AreaSpec,
      count = ONE,
      lattice = false,
      size = { width: 60, height: 40 },
    ): Area[] {
      const state = emptyMap({ ...size, tile: Tile.Wall })();
      return Array.from({ length: SEEDS }, (_, seed) =>
        placeAreas(state, mulberry32(seed), area, count, { lattice }),
      ).flat();
    }

    it('puts the left edge in the window', () => {
      // given
      const area = {
        width: { min: 5, max: 10 },
        height: { min: 5, max: 5 },
        x: { min: 10, max: 14, anchor: 'left' as const },
      };

      // when
      const boxes = placeMany(area);

      // then
      for (const { x } of boxes) {
        expect(x).toBeGreaterThanOrEqual(10);
        expect(x).toBeLessThanOrEqual(14);
      }
    });

    it('puts the right edge in the window', () => {
      // given
      const area = {
        width: { min: 5, max: 10 },
        height: { min: 5, max: 5 },
        x: { min: 50, max: 59, anchor: 'right' as const },
      };

      // when
      const boxes = placeMany(area);

      // then
      for (const { x, width } of boxes) {
        expect(x + width - 1).toBeGreaterThanOrEqual(50);
        expect(x + width - 1).toBeLessThanOrEqual(59);
      }
    });

    it('puts the center in the window by default', () => {
      // given
      const area = {
        width: { min: 5, max: 10 },
        height: { min: 5, max: 5 },
        x: { min: 30, max: 30 },
      };

      // when
      const boxes = placeMany(area);

      // then
      for (const { x, width } of boxes) {
        expect(x + Math.floor(width / 2)).toBe(30);
      }
    });

    it('puts the top and bottom edges in a window down the map', () => {
      // given
      const top = {
        width: { min: 5, max: 5 },
        height: { min: 4, max: 8 },
        y: { min: 0, max: 2, anchor: 'top' as const },
      };
      const bottom = {
        ...top,
        y: { min: 37, max: 39, anchor: 'bottom' as const },
      };

      // when
      const high = placeMany(top);
      const low = placeMany(bottom);

      // then
      for (const { y } of high) {
        expect(y).toBeLessThanOrEqual(2);
      }
      for (const { y, height } of low) {
        expect(y + height - 1).toBeGreaterThanOrEqual(37);
      }
    });

    it('leaves the other axis free', () => {
      // given
      const area = {
        width: { min: 5, max: 5 },
        height: { min: 5, max: 5 },
        x: { min: 0, max: 0, anchor: 'left' as const },
      };

      // when
      const boxes = placeMany(area);

      // then
      expect(new Set(boxes.map(({ y }) => y)).size).toBeGreaterThan(5);
    });

    it('puts every copy in the window', () => {
      // given
      const area = {
        width: { min: 6, max: 6 },
        height: { min: 6, max: 6 },
        y: { min: 0, max: 10, anchor: 'top' as const },
      };

      // when
      const boxes = placeMany(area, { min: 3, max: 3 });

      // then
      expect(boxes).toHaveLength(3 * SEEDS);
      for (const { y } of boxes) {
        expect(y).toBeLessThanOrEqual(10);
      }
    });

    it('starts on even coordinates on a lattice', () => {
      // given
      const area = {
        width: { min: 5, max: 9 },
        height: { min: 5, max: 9 },
        x: { min: 10, max: 20, anchor: 'right' as const },
        y: { min: 10, max: 20 },
      };

      // when
      const boxes = placeMany(area, ONE, true, { width: 41, height: 31 });

      // then
      for (const { x, y, width, height } of boxes) {
        expect(x % 2).toBe(0);
        expect(y % 2).toBe(0);
        expect(x + width - 1).toBeGreaterThanOrEqual(10);
        expect(x + width - 1).toBeLessThanOrEqual(20);
        expect(y + Math.floor(height / 2)).toBeGreaterThanOrEqual(10);
        expect(y + Math.floor(height / 2)).toBeLessThanOrEqual(20);
      }
    });

    it('ends at most one tile off the window on a lattice when no even spot fits it', () => {
      // given
      const area = {
        width: { min: 7, max: 7 },
        height: { min: 5, max: 5 },
        x: { min: 10, max: 10 },
      };

      // when
      const boxes = placeMany(area, ONE, true, { width: 41, height: 31 });

      // then
      for (const { x } of boxes) {
        expect(x % 2).toBe(0);
        expect(Math.abs(x + 3 - 10)).toBe(1);
      }
    });
  });

  describe('with gravity', () => {
    const SEEDS = 30;
    const BOX = { width: { min: 10, max: 10 }, height: { min: 8, max: 8 } };

    it.each([
      ['left', 0, 11],
      ['top left', 0, 0],
      ['top', 15, 0],
      ['top right', 30, 0],
      ['right', 30, 11],
      ['bottom right', 30, 22],
      ['bottom', 15, 22],
      ['bottom left', 0, 22],
      ['center', 15, 11],
    ] as const)(
      'pulls a box %s on an empty map at full strength',
      (toward, x, y) => {
        // given
        const state = emptyMap({ width: 40, height: 30, tile: Tile.Wall })();
        const area = { ...BOX, gravity: { toward, strength: 1 } };

        // when
        const boxes = Array.from({ length: SEEDS }, (_, seed) =>
          placeAreas(state, mulberry32(seed), area, ONE),
        ).flat();

        // then
        for (const box of boxes) {
          expect(box).toEqual({ x, y, width: 10, height: 8 });
        }
      },
    );

    it('stops against what is in the way while the other axis carries on', () => {
      // given
      const state = emptyMap({ width: 40, height: 30, tile: Tile.Wall })();
      for (let y = 0; y < 30; ++y) {
        state.reserved.fill(Reserve.Solid, y * 40, y * 40 + 11);
      }
      const area = {
        ...BOX,
        gravity: { toward: 'bottom left' as const, strength: 1 },
      };

      // when
      const boxes = Array.from({ length: SEEDS }, (_, seed) =>
        placeAreas(state, mulberry32(seed), area, ONE),
      ).flat();

      // then
      for (const box of boxes) {
        expect(box).toEqual({ x: 12, y: 22, width: 10, height: 8 });
      }
    });

    it('leaves the box where it was drawn at strength 0', () => {
      // given
      const state = emptyMap({ width: 40, height: 30, tile: Tile.Wall })();
      const area = {
        ...BOX,
        gravity: { toward: 'top left' as const, strength: 0 },
      };

      // when
      const pulled = Array.from({ length: SEEDS }, (_, seed) =>
        placeAreas(state, mulberry32(seed), area, ONE),
      );
      const free = Array.from({ length: SEEDS }, (_, seed) =>
        placeAreas(state, mulberry32(seed), BOX, ONE),
      );

      // then
      expect(pulled).toEqual(free);
    });

    it('slides half the way at strength 0.5', () => {
      // given
      const state = emptyMap({ width: 40, height: 30, tile: Tile.Wall })();
      const area = {
        ...BOX,
        gravity: { toward: 'bottom right' as const, strength: 0.5 },
      };

      // when
      const pulled = Array.from({ length: SEEDS }, (_, seed) =>
        placeAreas(state, mulberry32(seed), area, ONE),
      ).flat();
      const free = Array.from({ length: SEEDS }, (_, seed) =>
        placeAreas(state, mulberry32(seed), BOX, ONE),
      ).flat();

      // then
      pulled.forEach((box, index) => {
        const drawn = free[index] as Area;
        expect(box.x).toBe(drawn.x + Math.round(0.5 * (30 - drawn.x)));
        expect(box.y).toBe(drawn.y + Math.round(0.5 * (22 - drawn.y)));
      });
    });

    it('piles copies up against each other', () => {
      // given
      const state = emptyMap({ width: 40, height: 10, tile: Tile.Wall })();
      const area = {
        width: { min: 6, max: 6 },
        height: { min: 10, max: 10 },
        gravity: { toward: 'left' as const, strength: 1 },
      };

      // when
      const boxes = Array.from({ length: SEEDS }, (_, seed) =>
        placeAreas(state, mulberry32(seed), area, { min: 3, max: 3 }),
      );

      // then
      for (const copies of boxes) {
        expect(copies.map(({ x }) => x)).toEqual([0, 7, 14]);
      }
    });

    it('lands on even coordinates on a lattice', () => {
      // given
      const state = emptyMap({ width: 40, height: 30, tile: Tile.Wall })();
      const area = {
        width: { min: 9, max: 9 },
        height: { min: 7, max: 7 },
        gravity: { toward: 'bottom right' as const, strength: 1 },
      };

      // when
      const boxes = Array.from({ length: SEEDS }, (_, seed) =>
        placeAreas(state, mulberry32(seed), area, ONE, { lattice: true }),
      ).flat();

      // then
      for (const box of boxes) {
        expect(box).toEqual({ x: 30, y: 22, width: 9, height: 7 });
      }
    });

    it('centers on even coordinates on a lattice', () => {
      // given
      const state = emptyMap({ width: 41, height: 31, tile: Tile.Wall })();
      const area = {
        width: { min: 9, max: 9 },
        height: { min: 9, max: 9 },
        gravity: { toward: 'center' as const, strength: 1 },
      };

      // when
      const boxes = Array.from({ length: SEEDS }, (_, seed) =>
        placeAreas(state, mulberry32(seed), area, ONE, { lattice: true }),
      ).flat();

      // then
      for (const box of boxes) {
        expect(box).toEqual({ x: 16, y: 10, width: 9, height: 9 });
      }
    });

    it('takes the whole map for a box as big as the map', () => {
      // given
      const state = emptyMap({ width: 40, height: 30, tile: Tile.Wall })();
      const area = { gravity: { toward: 'left' as const, strength: 1 } };

      // when
      const boxes = placeAreas(state, mulberry32(1), area, ONE);

      // then
      expect(boxes).toEqual([{ x: 0, y: 0, width: 40, height: 30 }]);
    });
  });

  describe('with accepts', () => {
    const SEEDS = 30;
    const BOX = { width: { min: 5, max: 5 }, height: { min: 5, max: 5 } };

    it('keeps only drawn spots that it accepts', () => {
      // given
      const state = emptyMap({ width: 40, height: 30, tile: Tile.Wall })();
      const accepts = (box: Area): boolean => box.x >= 20;

      // when
      const boxes = Array.from({ length: SEEDS }, (_, seed) =>
        placeAreas(state, mulberry32(seed), BOX, ONE, { accepts }),
      ).flat();

      // then
      expect(boxes).toHaveLength(SEEDS);
      for (const { x } of boxes) {
        expect(x).toBeGreaterThanOrEqual(20);
      }
    });

    it('is asked only about boxes that are clear', () => {
      // given
      const state = emptyMap({ width: 30, height: 10, tile: Tile.Wall })();
      for (let y = 0; y < 10; ++y) {
        state.reserved.fill(Reserve.Solid, y * 30, y * 30 + 14);
      }
      const asked: Area[] = [];
      const accepts = (box: Area): boolean => {
        asked.push(box);
        return true;
      };

      // when
      placeAreas(state, mulberry32(1), BOX, ONE, { accepts });

      // then
      expect(asked.length).toBeGreaterThan(0);
      for (const { x } of asked) {
        expect(x).toBeGreaterThanOrEqual(15);
      }
    });

    it('throws an ordinary Error when it accepts no spot', () => {
      // given
      const state = emptyMap({ width: 30, height: 10, tile: Tile.Wall })();

      // when
      const call = () =>
        placeAreas(state, mulberry32(1), BOX, ONE, { accepts: () => false });

      // then
      expect(call).toThrow(/No free spot/);
      expect(call).not.toThrow(RangeError);
    });

    it('stops a slide at the first step that it does not accept', () => {
      // given
      const state = emptyMap({ width: 40, height: 30, tile: Tile.Wall })();
      const area = {
        ...BOX,
        gravity: { toward: 'left' as const, strength: 1 },
      };
      const accepts = (box: Area): boolean => box.x >= 10;

      // when
      const boxes = Array.from({ length: SEEDS }, (_, seed) =>
        placeAreas(state, mulberry32(seed), area, ONE, { accepts }),
      ).flat();

      // then
      for (const { x } of boxes) {
        expect(x).toBe(10);
      }
    });

    it('is asked about the whole map for a box as big as the map', () => {
      // given
      const state = emptyMap({ width: 40, height: 30, tile: Tile.Wall })();
      const asked: Area[] = [];
      const accepts = (box: Area): boolean => {
        asked.push(box);
        return true;
      };

      // when
      const boxes = placeAreas(state, mulberry32(1), {}, ONE, { accepts });

      // then
      expect(asked).toEqual([{ x: 0, y: 0, width: 40, height: 30 }]);
      expect(boxes).toEqual(asked);
    });

    it('throws an ordinary Error when it does not accept the whole map', () => {
      // given
      const state = emptyMap({ width: 40, height: 30, tile: Tile.Wall })();

      // when
      const call = () =>
        placeAreas(state, mulberry32(1), {}, ONE, { accepts: () => false });

      // then
      expect(call).toThrow(/whole 40 by 30 map.*not accepted/);
      expect(call).not.toThrow(RangeError);
    });

    it('draws the same boxes as without it when it accepts everything', () => {
      // given
      const state = emptyMap({ width: 60, height: 40, tile: Tile.Wall })();
      const area = {
        width: { min: 5, max: 12 },
        height: { min: 5, max: 9 },
        gravity: { toward: 'top' as const, strength: 0.5 },
      };
      const count = { min: 1, max: 4 };

      // when
      const accepted = Array.from({ length: SEEDS }, (_, seed) =>
        placeAreas(state, mulberry32(seed), area, count, {
          accepts: () => true,
        }),
      );
      const plain = Array.from({ length: SEEDS }, (_, seed) =>
        placeAreas(state, mulberry32(seed), area, count),
      );

      // then
      expect(accepted).toEqual(plain);
    });
  });
});
