import { describe, expect, it } from 'vitest';
import { mulberry32 } from '../test-helpers/mulberry32';
import { createSimplexNoise } from './create-simplex-noise';
import { transformNoise } from './transform-noise';

const simplex = createSimplexNoise(mulberry32(1));

/** Reports the position it was asked about, to see what the transform does. */
const probeX = (x: number) => x;
const probeY = (_x: number, y: number) => y;

/** The total change of the noise per unit step along a direction. */
function variation(
  noise: (x: number, y: number) => number,
  dx: number,
  dy: number,
) {
  let total = 0;
  for (let i = 0; i < 400; ++i) {
    const x = 20 + (i % 20) * 3.1;
    const y = 20 + Math.floor(i / 20) * 3.1;
    total += Math.abs(noise(x + dx * 0.1, y + dy * 0.1) - noise(x, y));
  }
  return total;
}

describe('transformNoise', () => {
  it('leaves the noise alone by default', () => {
    // given
    const noise = transformNoise(simplex);

    // when
    const values = [noise(1.3, 2.7), noise(-4.1, 0.2)];

    // then
    expect(values).toEqual([simplex(1.3, 2.7), simplex(-4.1, 0.2)]);
  });

  it('divides x by scaleX', () => {
    // given
    const noise = transformNoise(probeX, { scaleX: 4, scaleY: 9 });

    // when
    const value = noise(8, 3);

    // then
    expect(value).toBe(2);
  });

  it('divides y by scaleY', () => {
    // given
    const noise = transformNoise(probeY, { scaleX: 4, scaleY: 3 });

    // when
    const value = noise(8, 6);

    // then
    expect(value).toBe(2);
  });

  it('stretches the shapes along the axis with the larger scale', () => {
    // given
    const noise = transformNoise(simplex, { scaleX: 20, scaleY: 2 });

    // when
    const alongX = variation(noise, 1, 0);
    const alongY = variation(noise, 0, 1);

    // then
    expect(alongX).toBeLessThan(alongY / 4);
  });

  it('turns the stretched axis down with a rotation of 90 degrees', () => {
    // given
    const noise = transformNoise(simplex, {
      scaleX: 20,
      scaleY: 2,
      rotation: 90,
    });

    // when
    const alongX = variation(noise, 1, 0);
    const alongY = variation(noise, 0, 1);

    // then
    expect(alongY).toBeLessThan(alongX / 4);
  });

  it('stretches the shapes down and to the right with a rotation of 45 degrees', () => {
    // given
    const noise = transformNoise(simplex, {
      scaleX: 20,
      scaleY: 2,
      rotation: 45,
    });

    // when
    const alongDiagonal = variation(noise, 1, 1);
    const acrossDiagonal = variation(noise, 1, -1);

    // then
    expect(alongDiagonal).toBeLessThan(acrossDiagonal / 4);
  });

  it('maps a point to the right onto the negative noise y axis with a rotation of 90 degrees', () => {
    // given
    const rotated = transformNoise(probeY, { rotation: 90 });

    // when
    const value = rotated(1, 0);

    // then
    expect(value).toBeCloseTo(-1);
  });

  it('treats a full turn like no turn', () => {
    // given
    const turned = transformNoise(simplex, {
      scaleX: 5,
      scaleY: 3,
      rotation: 360,
    });
    const plain = transformNoise(simplex, { scaleX: 5, scaleY: 3 });

    // when
    const values = [turned(7.7, 3.3), plain(7.7, 3.3)];

    // then
    expect(values[0]).toBeCloseTo(values[1] as number);
  });

  it('treats a negative rotation as the opposite turn', () => {
    // given
    const back = transformNoise(simplex, {
      scaleX: 5,
      scaleY: 3,
      rotation: -30,
    });
    const forward = transformNoise(simplex, {
      scaleX: 5,
      scaleY: 3,
      rotation: 330,
    });

    // when
    const values = [back(7.7, 3.3), forward(7.7, 3.3)];

    // then
    expect(values[0]).toBeCloseTo(values[1] as number);
  });

  it('stays within -1 and 1 for noise that does', () => {
    // given
    const noise = transformNoise(simplex, {
      scaleX: 7,
      scaleY: 3,
      rotation: 20,
    });

    // when
    const values: number[] = [];
    for (let y = -30; y < 30; y += 0.7) {
      for (let x = -30; x < 30; x += 0.7) {
        values.push(noise(x, y));
      }
    }

    // then
    expect(values.every((v) => Math.abs(v) <= 1)).toBe(true);
  });

  it.each([
    ['scaleX', { scaleX: 0 }],
    ['scaleX', { scaleX: -2 }],
    ['scaleY', { scaleY: Infinity }],
    ['scaleY', { scaleY: Number.NaN }],
    ['rotation', { rotation: Infinity }],
    ['rotation', { rotation: Number.NaN }],
  ])('throws a RangeError for an invalid %s', (name, options) => {
    // given
    const transform = () => transformNoise(simplex, options);

    // when / then
    expect(transform).toThrow(RangeError);
    expect(transform).toThrow(name);
  });
});
