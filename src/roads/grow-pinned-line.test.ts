import { describe, expect, it } from 'vitest';
import { createSimplexNoise } from '../noise/create-simplex-noise';
import { mulberry32 } from '../test-helpers/mulberry32';
import { growPinnedLine } from './grow-pinned-line';
import type { PinnedLineOptions } from './grow-pinned-line';

function line(options: Partial<PinnedLineOptions> = {}, seed = 1) {
  return growPinnedLine({
    mapWidth: 100,
    mapHeight: 100,
    from: { x: 10.5, y: 10.5 },
    to: { x: 70.5, y: 50.5 },
    windiness: 1,
    noise: createSimplexNoise(mulberry32(seed)),
    lane: 0.5,
    ...options,
  });
}

/** How far a point is from the straight line through two points. */
function offLine(
  p: { x: number; y: number },
  a: { x: number; y: number },
  b: { x: number; y: number },
) {
  const length = Math.hypot(b.x - a.x, b.y - a.y);
  return (
    Math.abs((b.x - a.x) * (a.y - p.y) - (a.x - p.x) * (b.y - a.y)) / length
  );
}

describe('growPinnedLine', () => {
  it.each([1, 2, 3, 4, 5])(
    'starts and ends exactly at its ends with seed %s',
    (seed) => {
      // given
      const options = { windiness: 1 };

      // when
      const points = line(options, seed);

      // then
      expect(points[0]).toEqual({ x: 10.5, y: 10.5 });
      expect(points[points.length - 1]).toEqual({ x: 70.5, y: 50.5 });
    },
  );

  it('is straight without windiness', () => {
    // given
    const options = { windiness: 0 };

    // when
    const points = line(options);

    // then
    for (const p of points) {
      expect(
        offLine(p, { x: 10.5, y: 10.5 }, { x: 70.5, y: 50.5 }),
      ).toBeLessThan(1e-9);
    }
  });

  it('strays from the straight line with windiness', () => {
    // given
    const options = { windiness: 1 };

    // when
    const points = line(options);

    // then
    const strays = Math.max(
      ...points.map((p) =>
        offLine(p, { x: 10.5, y: 10.5 }, { x: 70.5, y: 50.5 }),
      ),
    );
    expect(strays).toBeGreaterThan(1);
    expect(strays).toBeLessThanOrEqual(12 + 1e-9);
  });

  it('strays only a little on a short line', () => {
    // given
    const options = { from: { x: 10.5, y: 10.5 }, to: { x: 18.5, y: 10.5 } };

    // when
    const points = line(options);

    // then
    for (const p of points) {
      expect(Math.abs(p.y - 10.5)).toBeLessThanOrEqual(2 + 1e-9);
    }
  });

  it('places points about a tile apart', () => {
    // given
    const options = { windiness: 0 };

    // when
    const points = line(options);

    // then
    expect(points).toHaveLength(Math.ceil(Math.hypot(60, 40)) + 1);
  });

  it('gives a different line to another lane', () => {
    // given
    const noise = createSimplexNoise(mulberry32(1));

    // when
    const a = line({ noise, lane: 0.5 });
    const b = line({ noise, lane: 8 });

    // then
    expect(a).not.toEqual(b);
  });

  it('stays inside the map', () => {
    // given
    const options = {
      mapWidth: 30,
      mapHeight: 30,
      from: { x: 0.5, y: 0.5 },
      to: { x: 29.5, y: 0.5 },
    };

    // when
    const points = line(options);

    // then
    for (const p of points) {
      expect(p.x).toBeGreaterThanOrEqual(0);
      expect(p.y).toBeGreaterThanOrEqual(0);
      expect(p.x).toBeLessThan(30);
    }
  });

  it('is a single point when the ends are the same', () => {
    // given
    const options = { to: { x: 10.5, y: 10.5 } };

    // when
    const points = line(options);

    // then
    expect(points.every((p) => p.x === 10.5 && p.y === 10.5)).toBe(true);
  });
});
