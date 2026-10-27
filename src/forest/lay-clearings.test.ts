import { describe, expect, it } from 'vitest';
import { mulberry32 } from '../test-helpers/mulberry32';
import type { ClearingSpec } from './clearing-spec';
import { layClearings } from './lay-clearings';

function lay(specs: ClearingSpec[], spacing = 0, seed = 1, size = 80) {
  return layClearings(specs, size, size, mulberry32(seed), { spacing });
}

const RANDOM = { radiusX: { min: 5, max: 5 } };

describe('layClearings', () => {
  it('places a clearing without a center at a whole position', () => {
    // given
    const specs = [RANDOM];

    // when
    const { clearings } = lay(specs);

    // then
    expect(Number.isInteger(clearings[0]?.x)).toBe(true);
    expect(Number.isInteger(clearings[0]?.y)).toBe(true);
  });

  it('keeps the whole oval of a random clearing inside the map', () => {
    // given
    const specs = Array.from({ length: 10 }, () => ({
      radiusX: { min: 9, max: 9 },
    }));

    // when
    const { clearings } = lay(specs, 0, 2, 40);

    // then
    for (const { x, y } of clearings) {
      expect(Math.min(x, y)).toBeGreaterThanOrEqual(9);
      expect(Math.max(x, y)).toBeLessThanOrEqual(30);
    }
  });

  it('keeps random clearings apart by their radii', () => {
    // given
    const specs = Array.from({ length: 6 }, () => ({
      radiusX: { min: 8, max: 8 },
    }));

    // when
    const { clearings } = lay(specs, 0, 3);

    // then
    expect(clearings).toHaveLength(6);
    for (const [i, a] of clearings.entries()) {
      for (const b of clearings.slice(i + 1)) {
        expect(Math.hypot(a.x - b.x, a.y - b.y)).toBeGreaterThanOrEqual(16);
      }
    }
  });

  it('keeps random clearings further apart with spacing', () => {
    // given
    const specs = Array.from({ length: 4 }, () => ({
      radiusX: { min: 5, max: 5 },
    }));

    // when
    const { clearings } = lay(specs, 10, 4);

    // then
    expect(clearings).toHaveLength(4);
    for (const [i, a] of clearings.entries()) {
      for (const b of clearings.slice(i + 1)) {
        expect(Math.hypot(a.x - b.x, a.y - b.y)).toBeGreaterThanOrEqual(20);
      }
    }
  });

  it('keeps random clearings away from one with a center of its own', () => {
    // given
    const specs = [
      { x: 40, y: 40, radiusX: { min: 15, max: 15 } },
      ...Array.from({ length: 5 }, () => ({ radiusX: { min: 6, max: 6 } })),
    ];

    // when
    const { clearings } = lay(specs, 0, 5);

    // then
    for (const { x, y } of clearings.slice(1)) {
      expect(Math.hypot(x - 40, y - 40)).toBeGreaterThanOrEqual(21);
    }
  });

  it('does not move a clearing that has a center', () => {
    // given
    const specs = [RANDOM, { x: 3, y: 4, radiusX: { min: 2, max: 2 } }];

    // when
    const { clearings } = lay(specs);

    // then
    expect(clearings[1]).toMatchObject({ x: 3, y: 4 });
  });

  it('reports the clearings in the order they were asked for', () => {
    // given
    const specs = [
      { radiusX: { min: 3, max: 3 } },
      { x: 40, y: 40, radiusX: { min: 4, max: 4 } },
      { radiusX: { min: 5, max: 5 } },
    ];

    // when
    const { clearings } = lay(specs);

    // then
    expect(clearings.map((c) => c.radiusX)).toEqual([3, 4, 5]);
  });

  it('picks the radii from their ranges', () => {
    // given
    const specs = Array.from({ length: 12 }, (_, i) => ({
      x: 10 + (i % 4) * 20,
      y: 10 + Math.floor(i / 4) * 20,
      radiusX: { min: 2, max: 6 },
      radiusY: { min: 3, max: 9 },
    }));

    // when
    const { clearings } = lay(specs);

    // then
    expect(clearings).toHaveLength(12);
    for (const { radiusX, radiusY } of clearings) {
      expect(radiusX).toBeGreaterThanOrEqual(2);
      expect(radiusX).toBeLessThanOrEqual(6);
      expect(radiusY).toBeGreaterThanOrEqual(3);
      expect(radiusY).toBeLessThanOrEqual(9);
    }
    expect(new Set(clearings.map((c) => c.radiusX)).size).toBeGreaterThan(1);
  });

  it('makes a circle from the one radius that was picked when radiusY is left out', () => {
    // given
    const specs = Array.from({ length: 6 }, (_, i) => ({
      x: 10 + i * 12,
      y: 40,
      radiusX: { min: 2, max: 6 },
    }));

    // when
    const { clearings } = lay(specs);

    // then
    for (const { radiusX, radiusY } of clearings) {
      expect(radiusY).toBe(radiusX);
    }
  });

  it('leaves out a clearing that finds no room', () => {
    // given
    const specs = [{ x: 20, y: 20, radiusX: { min: 40, max: 40 } }, RANDOM];

    // when
    const { clearings } = lay(specs, 0, 1, 40);

    // then
    expect(clearings).toHaveLength(1);
  });

  it('leaves out a clearing that is larger than the map', () => {
    // given
    const specs = [{ radiusX: { min: 30, max: 30 } }];

    // when
    const { clearings } = lay(specs, 0, 1, 40);

    // then
    expect(clearings).toEqual([]);
  });

  it('covers the tiles of a random clearing', () => {
    // given
    const specs = [RANDOM];

    // when
    const { covered, clearings } = lay(specs);

    // then
    const [clearing] = clearings;
    expect(covered[(clearing?.y ?? 0) * 80 + (clearing?.x ?? 0)]).toBe(1);
  });

  it('is deterministic for the same seed', () => {
    // given
    const specs = [RANDOM, RANDOM, RANDOM];

    // when
    const a = lay(specs, 0, 9);
    const b = lay(specs, 0, 9);

    // then
    expect(a.clearings).toEqual(b.clearings);
    expect(a.covered).toEqual(b.covered);
  });

  it('places differently with another seed', () => {
    // given
    const specs = [RANDOM];

    // when
    const a = lay(specs, 0, 1);
    const b = lay(specs, 0, 2);

    // then
    expect(a.clearings).not.toEqual(b.clearings);
  });
});

describe('layClearings with roads', () => {
  const SIZE = 100;

  /** A road down the middle column of the map. */
  function roadMap() {
    const covered = new Uint8Array(SIZE * SIZE);
    for (let y = 0; y < SIZE; ++y) {
      covered[y * SIZE + 50] = 1;
    }
    return { covered, metric: 'chebyshev' as const };
  }

  function lay(specs: ClearingSpec[], seed = 1) {
    return layClearings(specs, SIZE, SIZE, mulberry32(seed), {
      roads: roadMap(),
    });
  }

  it('places a random clearing within the road distance of the road', () => {
    // given
    const specs = Array.from({ length: 5 }, () => ({
      radiusX: { min: 3, max: 3 },
      roadDistance: { min: 12, max: 15 },
    }));

    // when
    const { clearings } = lay(specs);

    // then
    expect(clearings).toHaveLength(5);
    for (const { x } of clearings) {
      expect(Math.abs(x - 50)).toBeGreaterThanOrEqual(12);
      expect(Math.abs(x - 50)).toBeLessThanOrEqual(15);
    }
  });

  it('defaults to a road distance of 8 to 25', () => {
    // given
    const specs = Array.from({ length: 8 }, () => ({
      radiusX: { min: 3, max: 3 },
    }));

    // when
    const { clearings } = lay(specs, 2);

    // then
    for (const { x } of clearings) {
      expect(Math.abs(x - 50)).toBeGreaterThanOrEqual(8);
      expect(Math.abs(x - 50)).toBeLessThanOrEqual(25);
    }
  });

  it('leaves out a clearing when no tile is in the road distance', () => {
    // given
    const specs = [
      { radiusX: { min: 3, max: 3 }, roadDistance: { min: 70, max: 80 } },
    ];

    // when
    const { clearings } = lay(specs);

    // then
    expect(clearings).toEqual([]);
  });

  it('does not apply the road distance to a clearing with a center', () => {
    // given
    const specs = [
      {
        x: 51,
        y: 40,
        radiusX: { min: 3, max: 3 },
        roadDistance: { min: 20, max: 30 },
      },
    ];

    // when
    const { clearings } = lay(specs);

    // then
    expect(clearings).toHaveLength(1);
  });
});

describe('layClearings paths', () => {
  it('asks for no path by default', () => {
    // given
    const specs = [{ x: 10, y: 10, radiusX: { min: 3, max: 3 } }];

    // when
    const { paths } = lay(specs);

    // then
    expect(paths).toEqual([]);
  });

  it('asks for a path with the defaults when the path is true', () => {
    // given
    const specs = [{ x: 10, y: 12, radiusX: { min: 3, max: 3 }, path: true }];

    // when
    const { paths } = lay(specs);

    // then
    expect(paths).toEqual([
      { to: { x: 10, y: 12 }, width: 1, windiness: 0.3, clearing: 0 },
    ]);
  });

  it('asks for a path with the options that were given', () => {
    // given
    const path = { width: 2, windiness: 0.8 };
    const specs = [{ x: 10, y: 12, radiusX: { min: 3, max: 3 }, path }];

    // when
    const { paths } = lay(specs);

    // then
    expect(paths).toEqual([
      { to: { x: 10, y: 12 }, width: 2, windiness: 0.8, clearing: 0 },
    ]);
  });

  it('asks for no path when the path is false', () => {
    // given
    const specs = [{ x: 10, y: 12, radiusX: { min: 3, max: 3 }, path: false }];

    // when
    const { paths } = lay(specs);

    // then
    expect(paths).toEqual([]);
  });

  it('asks for a path to a clearing at random only once it is placed', () => {
    // given
    const specs = [{ radiusX: { min: 3, max: 3 }, path: true }];

    // when
    const { paths, clearings } = lay(specs);

    // then
    expect(paths.map((path) => path.to)).toEqual([
      { x: clearings[0]?.x, y: clearings[0]?.y },
    ]);
  });
});
