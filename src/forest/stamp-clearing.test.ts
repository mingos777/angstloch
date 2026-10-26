import { describe, expect, it } from 'vitest';
import type { NoiseFunction } from '../noise/noise-function';
import { createSimplexNoise } from '../noise/create-simplex-noise';
import { mulberry32 } from '../test-helpers/mulberry32';
import type { Clearing } from './clearing';
import { stampClearing } from './stamp-clearing';

const SIZE = 61;
const CENTER = 30;
const FLAT: NoiseFunction = () => 0;

function stamp(
  shape: Partial<Clearing> = {},
  irregularity = 0,
  warp: NoiseFunction = FLAT,
  size = SIZE,
) {
  const covered = new Uint8Array(size * size);
  stampClearing(
    covered,
    size,
    size,
    {
      x: CENTER,
      y: CENTER,
      radiusX: 5,
      radiusY: 5,
      angle: 0,
      ...shape,
    },
    irregularity,
    warp,
  );
  return covered;
}

function at(covered: Uint8Array, x: number, y: number, size = SIZE) {
  return covered[y * size + x] === 1;
}

function area(covered: Uint8Array) {
  return covered.reduce((sum, flag) => sum + flag, 0);
}

describe('stampClearing', () => {
  it('marks the center', () => {
    // given
    const shape = { radiusX: 0.1, radiusY: 0.1 };

    // when
    const covered = stamp(shape);

    // then
    expect(at(covered, CENTER, CENTER)).toBe(true);
  });

  it('makes a circle without irregularity', () => {
    // given
    const shape = { radiusX: 5, radiusY: 5 };

    // when
    const covered = stamp(shape);

    // then
    expect(at(covered, CENTER + 5, CENTER)).toBe(true);
    expect(at(covered, CENTER + 6, CENTER)).toBe(false);
    expect(at(covered, CENTER, CENTER - 5)).toBe(true);
    expect(at(covered, CENTER + 4, CENTER + 4)).toBe(false);
  });

  it('makes an oval from two radii', () => {
    // given
    const shape = { radiusX: 6, radiusY: 2 };

    // when
    const covered = stamp(shape);

    // then
    expect(at(covered, CENTER + 6, CENTER)).toBe(true);
    expect(at(covered, CENTER, CENTER + 2)).toBe(true);
    expect(at(covered, CENTER, CENTER + 3)).toBe(false);
  });

  it('turns the oval clockwise by the angle', () => {
    // given
    const shape = { radiusX: 6, radiusY: 2, angle: 90 };

    // when
    const covered = stamp(shape);

    // then
    expect(at(covered, CENTER, CENTER + 6)).toBe(true);
    expect(at(covered, CENTER + 3, CENTER)).toBe(false);
  });

  it('is not a plain circle with irregularity', () => {
    // given
    const warp = createSimplexNoise(mulberry32(1));

    // when
    const plain = stamp({ radiusX: 8, radiusY: 8 });
    const ragged = stamp({ radiusX: 8, radiusY: 8 }, 1, warp);

    // then
    expect(ragged).not.toEqual(plain);
  });

  it('keeps about the same area with irregularity', () => {
    // given
    const shape = { radiusX: 10, radiusY: 10 };
    const plain = area(stamp(shape));

    // when
    const areas = [1, 2, 3, 4, 5].map((seed) =>
      area(stamp(shape, 1, createSimplexNoise(mulberry32(seed)))),
    );

    // then
    for (const ragged of areas) {
      expect(ragged).toBeGreaterThan(plain * 0.5);
      expect(ragged).toBeLessThan(plain * 1.6);
    }
  });

  it.each([1, 2, 3, 4, 5, 6])('is one connected piece with seed %s', (seed) => {
    // given
    const warp = createSimplexNoise(mulberry32(seed));

    // when
    const covered = stamp({ radiusX: 9, radiusY: 4, angle: 30 }, 1, warp);

    // then
    const reached = new Set([CENTER * SIZE + CENTER]);
    const pending = [CENTER * SIZE + CENTER];
    for (let tile = pending.pop(); tile !== undefined; tile = pending.pop()) {
      for (const next of [tile - 1, tile + 1, tile - SIZE, tile + SIZE]) {
        if (covered[next] === 1 && !reached.has(next)) {
          reached.add(next);
          pending.push(next);
        }
      }
    }
    expect(reached.size).toBe(area(covered));
  });

  it('is clipped by the edge of the map', () => {
    // given
    const shape = { x: 0, y: 0, radiusX: 4, radiusY: 4 };

    // when
    const covered = stamp(shape, 0, FLAT, 20);

    // then
    expect(at(covered, 0, 0, 20)).toBe(true);
    expect(at(covered, 4, 0, 20)).toBe(true);
    expect(area(covered)).toBeLessThan(area(stamp({ radiusX: 4 })));
  });
});
