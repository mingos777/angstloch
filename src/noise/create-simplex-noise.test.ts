import { describe, expect, it } from 'vitest';
import { mulberry32 } from '../test-helpers/mulberry32';
import { createSimplexNoise } from './create-simplex-noise';

function sample(noise: (x: number, y: number) => number, step = 0.37) {
  const values: number[] = [];
  for (let y = -40; y < 40; y += step) {
    for (let x = -40; x < 40; x += step) {
      values.push(noise(x, y));
    }
  }
  return values;
}

describe('createSimplexNoise', () => {
  it('is deterministic for the same random source', () => {
    // given
    const a = createSimplexNoise(mulberry32(1));
    const b = createSimplexNoise(mulberry32(1));

    // when
    const valuesA = sample(a);
    const valuesB = sample(b);

    // then
    expect(valuesA).toEqual(valuesB);
  });

  it('differs between random sources', () => {
    // given
    const a = createSimplexNoise(mulberry32(1));
    const b = createSimplexNoise(mulberry32(2));

    // when
    const valuesA = sample(a);
    const valuesB = sample(b);

    // then
    expect(valuesA).not.toEqual(valuesB);
  });

  it('stays within -1 and 1, including at negative positions', () => {
    // given
    const noise = createSimplexNoise(mulberry32(3));

    // when
    const values = sample(noise);

    // then
    expect(values.every((v) => Number.isFinite(v) && Math.abs(v) <= 1)).toBe(
      true,
    );
  });

  it('uses most of the range', () => {
    // given
    const noise = createSimplexNoise(mulberry32(4));

    // when
    const values = sample(noise, 0.11);

    // then
    const highest = values.reduce((a, b) => Math.max(a, b), -1);
    const lowest = values.reduce((a, b) => Math.min(a, b), 1);
    expect(highest).toBeGreaterThan(0.95);
    expect(lowest).toBeLessThan(-0.95);
  });

  it('averages out around zero', () => {
    // given
    const noise = createSimplexNoise(mulberry32(5));

    // when
    const values = sample(noise);

    // then
    const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
    expect(Math.abs(mean)).toBeLessThan(0.05);
  });

  it('changes smoothly between neighboring positions', () => {
    // given
    const noise = createSimplexNoise(mulberry32(6));
    const step = 0.01;

    // when
    let biggestJump = 0;
    for (let y = -10; y < 10; y += 0.31) {
      for (let x = -10; x < 10; x += 0.31) {
        biggestJump = Math.max(
          biggestJump,
          Math.abs(noise(x + step, y) - noise(x, y)),
          Math.abs(noise(x, y + step) - noise(x, y)),
        );
      }
    }

    // then
    expect(biggestJump).toBeLessThan(0.1);
  });

  it('varies from one unit to the next', () => {
    // given
    const noise = createSimplexNoise(mulberry32(7));

    // when
    const values = Array.from({ length: 50 }, (_, i) => noise(i * 1.3, 0.5));

    // then
    expect(new Set(values.map((v) => v.toFixed(2))).size).toBeGreaterThan(20);
  });

  it('does not need a random source', () => {
    // given
    const noise = createSimplexNoise();

    // when
    const value = noise(1.5, 2.5);

    // then
    expect(Math.abs(value)).toBeLessThanOrEqual(1);
  });

  it('does not use the random source once created', () => {
    // given
    let calls = 0;
    const counting = () => {
      ++calls;
      return 0.5;
    };
    const noise = createSimplexNoise(counting);
    const created = calls;

    // when
    sample(noise, 2);

    // then
    expect(calls).toBe(created);
  });
});
