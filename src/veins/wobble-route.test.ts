import { describe, expect, it } from 'vitest';
import type { Point } from '../core/point';
import { createSimplexNoise } from '../noise/create-simplex-noise';
import { mulberry32 } from '../test-helpers/mulberry32';
import { wobbleRoute } from './wobble-route';

const WIDTH = 60;
const HEIGHT = 30;

/** A route along a row, of the given length. */
function row(y: number, length: number): Point[] {
  return Array.from({ length }, (_, x) => ({ x: x + 2, y }));
}

describe('wobbleRoute', () => {
  const noise = createSimplexNoise(mulberry32(1));
  const free = new Uint8Array(WIDTH * HEIGHT);

  it('keeps the first and the last tile where they are', () => {
    // given
    const route = row(15, 40);

    // when
    const wobbled = wobbleRoute(route, WIDTH, HEIGHT, free, noise, 1, 3);

    // then
    expect(wobbled[0]).toEqual(route[0]);
    expect(wobbled[wobbled.length - 1]).toEqual(route[route.length - 1]);
  });

  it('bends a straight route at a windiness of 1', () => {
    // given
    const route = row(15, 40);

    // when
    const wobbled = wobbleRoute(route, WIDTH, HEIGHT, free, noise, 1, 3);

    // then
    expect(wobbled.some((tile) => tile.y !== 15)).toBe(true);
  });

  it('leaves a route as it is at a windiness of 0', () => {
    // given
    const route = row(15, 40);

    // when
    const wobbled = wobbleRoute(route, WIDTH, HEIGHT, free, noise, 0, 3);

    // then
    expect(wobbled).toEqual(route);
  });

  it('leaves a short route as it is', () => {
    // given
    const route = row(15, 6);

    // when
    const wobbled = wobbleRoute(route, WIDTH, HEIGHT, free, noise, 1, 3);

    // then
    expect(wobbled).toEqual(route);
  });

  it('steps along edges only', () => {
    // given
    const route = row(15, 40);

    // when
    const wobbled = wobbleRoute(route, WIDTH, HEIGHT, free, noise, 1, 3);

    // then
    for (let i = 1; i < wobbled.length; ++i) {
      const a = wobbled[i - 1] as Point;
      const b = wobbled[i] as Point;
      expect(Math.abs(a.x - b.x) + Math.abs(a.y - b.y)).toBe(1);
    }
  });

  it('never steps on a blocked tile', () => {
    // given
    const route = row(15, 40);
    const blocked = new Uint8Array(WIDTH * HEIGHT);
    for (let x = 0; x < WIDTH; ++x) {
      blocked[13 * WIDTH + x] = 1;
      blocked[14 * WIDTH + x] = 1;
      blocked[16 * WIDTH + x] = 1;
      blocked[17 * WIDTH + x] = 1;
    }

    // when
    const wobbled = wobbleRoute(route, WIDTH, HEIGHT, blocked, noise, 1, 3);

    // then
    expect(wobbled.every(({ x, y }) => blocked[y * WIDTH + x] === 0)).toBe(
      true,
    );
  });

  it('bends differently in different lanes', () => {
    // given
    const route = row(15, 40);

    // when
    const one = wobbleRoute(route, WIDTH, HEIGHT, free, noise, 1, 3);
    const other = wobbleRoute(route, WIDTH, HEIGHT, free, noise, 1, 17);

    // then
    expect(one).not.toEqual(other);
  });
});
