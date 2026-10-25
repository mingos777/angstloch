import { describe, expect, it } from 'vitest';
import { mulberry32 } from '../test-helpers/mulberry32';
import { createFractalNoise } from './create-fractal-noise';
import { createSimplexNoise } from './create-simplex-noise';

const base = createSimplexNoise(mulberry32(1));

function roughness(noise: (x: number, y: number) => number) {
  let total = 0;
  for (let x = 0; x < 30; x += 0.01) {
    total += Math.abs(noise(x + 0.01, 0.5) - noise(x, 0.5));
  }
  return total;
}

describe('createFractalNoise', () => {
  it('equals the plain noise with one octave', () => {
    // given
    const fractal = createFractalNoise(base, { octaves: 1 });

    // when
    const values = [fractal(1.3, 2.7), fractal(-4.1, 0.2)];

    // then
    expect(values).toEqual([base(1.3, 2.7), base(-4.1, 0.2)]);
  });

  it('stays within -1 and 1', () => {
    // given
    const fractal = createFractalNoise(base, {
      octaves: 5,
      persistence: 1,
    });

    // when
    const values: number[] = [];
    for (let y = -20; y < 20; y += 0.3) {
      for (let x = -20; x < 20; x += 0.3) {
        values.push(fractal(x, y));
      }
    }

    // then
    expect(values.every((v) => Math.abs(v) <= 1)).toBe(true);
  });

  it('adds finer detail with more octaves', () => {
    // given
    const one = createFractalNoise(base, { octaves: 1 });
    const four = createFractalNoise(base, { octaves: 4, persistence: 1 });

    // when
    const smooth = roughness(one);
    const detailed = roughness(four);

    // then
    expect(detailed).toBeGreaterThan(smooth);
  });

  it('gives finer layers more weight with a higher persistence', () => {
    // given
    const weak = createFractalNoise(base, { octaves: 4, persistence: 0.2 });
    const strong = createFractalNoise(base, { octaves: 4, persistence: 0.9 });

    // when
    const rough = [roughness(weak), roughness(strong)];

    // then
    expect(rough[1]).toBeGreaterThan(rough[0] as number);
  });

  it('keeps only the first layer at a persistence of 0', () => {
    // given
    const fractal = createFractalNoise(base, { octaves: 4, persistence: 0 });

    // when
    const value = fractal(3.3, 1.1);

    // then
    expect(value).toBe(base(3.3, 1.1));
  });

  it('is deterministic', () => {
    // given
    const a = createFractalNoise(base);
    const b = createFractalNoise(base);

    // when
    const values = [a(2.2, 3.3), b(2.2, 3.3)];

    // then
    expect(values[0]).toBe(values[1]);
  });

  it.each([
    ['octaves', { octaves: 0 }],
    ['octaves', { octaves: 1.5 }],
    ['persistence', { persistence: 1.5 }],
    ['lacunarity', { lacunarity: 0 }],
    ['lacunarity', { lacunarity: Infinity }],
  ])('throws a RangeError for an invalid %s', (name, options) => {
    // given
    const create = () => createFractalNoise(base, options);

    // when / then
    expect(create).toThrow(RangeError);
    expect(create).toThrow(name);
  });
});
