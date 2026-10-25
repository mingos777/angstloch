import { describe, expect, it } from 'vitest';
import { placeTemplateCopies } from './place-template-copies';
import type { PlacementArea } from './placement-area';
import type { RoomTemplate } from './room-template';
import { TemplateCell } from './template-cell';
import { mulberry32 } from './test-helpers/mulberry32';

const { Floor: F, Wall: W, Exit: E } = TemplateCell;

const cell: RoomTemplate = {
  name: 'cell',
  cells: [
    [W, E, W],
    [W, F, W],
    [W, W, W],
  ],
};

const area: PlacementArea = {
  width: 41,
  height: 21,
  spacing: 1,
  lattice: false,
};

describe('placeTemplateCopies', () => {
  it('places one copy by default', () => {
    // given
    const template = cell;

    // when
    const placed = placeTemplateCopies(mulberry32(1), template, 0, area, []);

    // then
    expect(placed).toHaveLength(1);
  });

  it('places a number of copies within the count', () => {
    // given
    const template = { ...cell, count: { min: 3, max: 5 } };

    // when
    const placed = placeTemplateCopies(mulberry32(1), template, 0, area, []);

    // then
    expect(placed.length).toBeGreaterThanOrEqual(3);
    expect(placed.length).toBeLessThanOrEqual(5);
  });

  it('places no copies for a count of 0', () => {
    // given
    const template = { ...cell, count: { min: 0, max: 0 } };

    // when
    const placed = placeTemplateCopies(mulberry32(1), template, 0, area, []);

    // then
    expect(placed).toEqual([]);
  });

  it('keeps copies apart', () => {
    // given
    const template = { ...cell, count: { min: 6, max: 6 } };

    // when
    const placed = placeTemplateCopies(mulberry32(1), template, 0, area, []);

    // then
    const spots = new Set(
      placed.map(({ x, y }) => `${String(x)},${String(y)}`),
    );
    expect(spots.size).toBe(6);
  });

  it('gives every position to one copy', () => {
    // given
    const positions = [5, 15, 25, 35].map((x) => ({
      coords: { x, y: 10 },
      anchor: 'center' as const,
    }));
    const template = { ...cell, count: { min: 4, max: 4 }, positions };

    // when
    const placed = placeTemplateCopies(mulberry32(1), template, 0, area, []);

    // then
    expect(placed.map(({ x }) => x).sort((a, b) => a - b)).toEqual([
      4, 14, 24, 34,
    ]);
  });

  it('places copies beyond the positions at random', () => {
    // given
    const positions = [{ coords: { x: 20, y: 10 }, anchor: 'center' as const }];
    const template = { ...cell, count: { min: 3, max: 3 }, positions };

    // when
    const placed = placeTemplateCopies(mulberry32(1), template, 0, area, []);

    // then
    expect(placed).toHaveLength(3);
  });

  it('rejects an invalid template', () => {
    // given
    const template: RoomTemplate = { cells: [] };

    // when
    const place = () =>
      placeTemplateCopies(mulberry32(1), template, 0, area, []);

    // then
    expect(place).toThrow(RangeError);
  });

  it('does not return the obstacles', () => {
    // given
    const [first] = placeTemplateCopies(mulberry32(1), cell, 0, area, []);
    const obstacles = first ? [first] : [];

    // when
    const placed = placeTemplateCopies(mulberry32(2), cell, 0, area, obstacles);

    // then
    expect(placed).toHaveLength(1);
    expect(placed).not.toContain(first);
  });

  it('places copies inside the areas', () => {
    // given
    const areas = [
      { x: 1, y: 1, width: 8, height: 8 },
      { x: 30, y: 10, width: 8, height: 8 },
    ];
    const template = { ...cell, count: { min: 6, max: 6 }, areas };

    // when
    const placed = placeTemplateCopies(mulberry32(1), template, 0, area, []);

    // then
    for (const { x, y, width, height } of placed) {
      expect(
        areas.some(
          (a) =>
            x >= a.x &&
            y >= a.y &&
            x + width <= a.x + a.width &&
            y + height <= a.y + a.height,
        ),
      ).toBe(true);
    }
  });

  it('uses every area over many copies', () => {
    // given
    const areas = [
      { x: 1, y: 1, width: 8, height: 8 },
      { x: 30, y: 10, width: 8, height: 8 },
    ];
    const template = { ...cell, count: { min: 6, max: 6 }, areas };

    // when
    const placed = placeTemplateCopies(mulberry32(1), template, 0, area, []);

    // then
    expect(placed.some(({ x }) => x < 20)).toBe(true);
    expect(placed.some(({ x }) => x > 20)).toBe(true);
  });

  it('turns to another area when one has no room', () => {
    // given
    const areas = [
      { x: 1, y: 1, width: 3, height: 3 },
      { x: 30, y: 10, width: 8, height: 8 },
    ];
    const template = { ...cell, count: { min: 3, max: 3 }, areas };

    // when
    const placed = placeTemplateCopies(mulberry32(1), template, 0, area, []);

    // then
    expect(placed).toHaveLength(3);
  });

  it('throws when no area has room', () => {
    // given
    const areas = [{ x: 1, y: 1, width: 3, height: 3 }];
    const template = { ...cell, count: { min: 2, max: 2 }, areas };

    // when
    const place = () =>
      placeTemplateCopies(mulberry32(1), template, 0, area, []);

    // then
    expect(place).toThrow(/none of its 1 areas has room/);
  });

  it('gives positions first and areas to the other copies', () => {
    // given
    const positions = [{ coords: { x: 20, y: 10 }, anchor: 'center' as const }];
    const areas = [{ x: 1, y: 1, width: 8, height: 8 }];
    const template = { ...cell, count: { min: 3, max: 3 }, positions, areas };

    // when
    const placed = placeTemplateCopies(mulberry32(1), template, 0, area, []);

    // then
    expect(placed.filter(({ x }) => x >= 19 && x <= 21)).toHaveLength(1);
    expect(placed.filter(({ x }) => x < 9)).toHaveLength(2);
  });
});
