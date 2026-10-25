import { describe, expect, it } from 'vitest';
import { mulberry32 } from '../test-helpers/mulberry32';
import { layRoads } from './lay-roads';
import type { RoadOptions } from './road-options';

function lay(options: RoadOptions = {}, seed = 1, width = 80, height = 60) {
  return layRoads(width, height, mulberry32(seed), options);
}

function centerline(options: RoadOptions = {}, seed = 1) {
  return lay(options, seed).roads[0]?.points ?? [];
}

describe('layRoads', () => {
  it('lays one main road', () => {
    // given
    const options = {};

    // when
    const { roads, junctions } = lay(options);

    // then
    expect(roads).toHaveLength(1);
    expect(roads[0]?.kind).toBe('road');
    expect(junctions).toEqual([]);
  });

  it('is deterministic for the same seed', () => {
    // given
    const options = { windiness: 0.8 };

    // when
    const a = lay(options, 4);
    const b = lay(options, 4);

    // then
    expect(a.roads).toEqual(b.roads);
    expect(a.covered).toEqual(b.covered);
  });

  it('differs between seeds', () => {
    // given
    const options = {};

    // when
    const a = lay(options, 1);
    const b = lay(options, 2);

    // then
    expect(a.covered).not.toEqual(b.covered);
  });

  it('keeps every tile of the centerline on the map', () => {
    // given
    const options = { windiness: 1, angle: 'random' } as const;

    // when
    const points = centerline(options, 3);

    // then
    expect(
      points.every((p) => p.x >= 0 && p.x < 80 && p.y >= 0 && p.y < 60),
    ).toBe(true);
  });

  it('makes every tile of the centerline touch the one before it along an edge', () => {
    // given
    const options = { windiness: 1 };

    // when
    const points = centerline(options, 5);

    // then
    const steps = points
      .slice(1)
      .map(
        (p, i) =>
          Math.abs(p.x - (points[i]?.x ?? 0)) +
          Math.abs(p.y - (points[i]?.y ?? 0)),
      );
    expect(steps.every((step) => step === 1)).toBe(true);
  });

  it('covers every tile of the centerline', () => {
    // given
    const options = { width: { min: 1, max: 1 } };

    // when
    const { roads, covered } = lay(options);

    // then
    expect(roads[0]?.points.every((p) => covered[p.y * 80 + p.x] === 1)).toBe(
      true,
    );
  });

  it('runs left to right at an angle of 0', () => {
    // given
    const options = { angle: 0, windiness: 0 };

    // when
    const points = centerline(options, 2);

    // then
    expect(new Set(points.map((p) => p.y)).size).toBe(1);
    expect(points[0]?.x).toBe(0);
    expect(points[points.length - 1]?.x).toBe(79);
  });

  it('runs top to bottom at an angle of 90', () => {
    // given
    const options = { angle: 90, windiness: 0 };

    // when
    const points = centerline(options, 2);

    // then
    expect(new Set(points.map((p) => p.x)).size).toBe(1);
    expect(points[0]?.y).toBe(0);
    expect(points[points.length - 1]?.y).toBe(59);
  });

  it('runs diagonally down and to the right at an angle of 45', () => {
    // given
    const options = { angle: 45, windiness: 0 };

    // when
    const points = centerline(options, 2);

    // then
    const first = points[0];
    const last = points[points.length - 1];
    const dx = (last?.x ?? 0) - (first?.x ?? 0);
    const dy = (last?.y ?? 0) - (first?.y ?? 0);
    expect(dx).toBeGreaterThan(20);
    expect(Math.abs(dx - dy)).toBeLessThanOrEqual(2);
  });

  it('runs up and to the right at an angle of 315', () => {
    // given
    const options = { angle: 315, windiness: 0 };

    // when
    const points = centerline(options, 2);

    // then
    const first = points[0];
    const last = points[points.length - 1];
    expect((last?.x ?? 0) - (first?.x ?? 0)).toBeGreaterThan(20);
    expect((last?.y ?? 0) - (first?.y ?? 0)).toBeLessThan(-20);
  });

  it('picks different angles with random', () => {
    // given
    const slopes = new Set<string>();

    // when
    for (let seed = 1; seed <= 10; ++seed) {
      const points = centerline({ angle: 'random', windiness: 0 }, seed);
      const first = points[0];
      const last = points[points.length - 1];
      slopes.add(
        (
          ((last?.y ?? 0) - (first?.y ?? 0)) /
          ((last?.x ?? 1) - (first?.x ?? 0) || 1)
        ).toFixed(1),
      );
    }

    // then
    expect(slopes.size).toBeGreaterThan(4);
  });

  it('leaves the map at both ends, on the border', () => {
    // given
    const options = { windiness: 0.7 };

    // when
    const { exits } = lay(options, 6);

    // then
    expect(exits).toHaveLength(2);
    for (const { x, y } of exits) {
      expect(x === 0 || y === 0 || x === 79 || y === 59).toBe(true);
    }
  });

  it('winds more with a higher windiness', () => {
    // given
    const straight = centerline({ angle: 0, windiness: 0 }, 3);
    const winding = centerline({ angle: 0, windiness: 1 }, 3);

    // when
    const spread = (points: { y: number }[]) =>
      Math.max(...points.map((p) => p.y)) - Math.min(...points.map((p) => p.y));

    // then
    expect(spread(straight)).toBe(0);
    expect(spread(winding)).toBeGreaterThan(3);
  });

  it('never strays more than 12 tiles from a straight line', () => {
    // given
    const options = { angle: 0, windiness: 1 };

    // when
    const points = centerline(options, 7);

    // then
    const ys = points.map((p) => p.y);
    expect(Math.max(...ys) - Math.min(...ys)).toBeLessThanOrEqual(25);
  });

  it('covers more tiles with a greater width', () => {
    // given
    const count = (width: number) =>
      lay(
        { angle: 0, windiness: 0, width: { min: width, max: width } },
        2,
      ).covered.reduce((sum, c) => sum + c, 0);

    // when
    const narrow = count(1);
    const wide = count(5);

    // then
    expect(wide).toBeGreaterThan(narrow * 3);
  });

  it('picks the width from the range', () => {
    // given
    const widths = new Set<number>();

    // when
    for (let seed = 1; seed <= 20; ++seed) {
      widths.add(lay({ width: { min: 2, max: 5 } }, seed).roads[0]?.width ?? 0);
    }

    // then
    expect([...widths].every((w) => w >= 2 && w <= 5)).toBe(true);
    expect(widths.size).toBeGreaterThan(2);
  });

  it('uses a width of 3 by default', () => {
    // given
    const options = {};

    // when
    const { roads } = lay(options);

    // then
    expect(roads[0]?.width).toBe(3);
  });

  it('works on a map as small as one tile', () => {
    // given
    const options = {};

    // when
    const { roads, covered } = layRoads(1, 1, mulberry32(1), options);

    // then
    expect(roads[0]?.points).toEqual([{ x: 0, y: 0 }]);
    expect(covered[0]).toBe(1);
  });

  it.each([
    ['angle', { angle: Number.NaN }],
    ['angle', { angle: Infinity }],
    ['roads.width', { width: { min: 0, max: 2 } }],
    ['roads.width', { width: { min: 4, max: 2 } }],
    ['roads.windiness', { windiness: 1.5 }],
  ])('throws a RangeError for an invalid %s', (name, options) => {
    // given
    const generate = () => lay(options);

    // when / then
    expect(generate).toThrow(RangeError);
    expect(generate).toThrow(name);
  });
});
