import { describe, expect, it } from 'vitest';
import type { Point } from '../core/point';
import { findRockRoute } from './find-rock-route';

/** A blocked map from rows of text, where `#` is blocked. */
function parse(rows: string[]): {
  blocked: Uint8Array;
  width: number;
  height: number;
} {
  const width = rows[0]?.length ?? 0;
  const blocked = new Uint8Array(width * rows.length);
  rows.forEach((row, y) => {
    row.split('').forEach((char, x) => {
      blocked[y * width + x] = char === '#' ? 1 : 0;
    });
  });
  return { blocked, width, height: rows.length };
}

const touchesAlongAnEdge = (a: Point, b: Point) =>
  Math.abs(a.x - b.x) + Math.abs(a.y - b.y) === 1;

describe('findRockRoute', () => {
  it('takes the shortest route over open ground', () => {
    // given
    const { blocked, width, height } = parse(['.......', '.......', '.......']);

    // when
    const route = findRockRoute(
      width,
      height,
      blocked,
      { x: 0, y: 0 },
      { x: 6, y: 2 },
    );

    // then
    expect(route).toHaveLength(9);
    expect(route?.[0]).toEqual({ x: 0, y: 0 });
    expect(route?.[8]).toEqual({ x: 6, y: 2 });
  });

  it('steps along edges only', () => {
    // given
    const { blocked, width, height } = parse([
      '.....',
      '.....',
      '.....',
      '.....',
    ]);

    // when
    const route =
      findRockRoute(width, height, blocked, { x: 0, y: 0 }, { x: 4, y: 3 }) ??
      [];

    // then
    for (let i = 1; i < route.length; ++i) {
      expect(touchesAlongAnEdge(route[i - 1] as Point, route[i] as Point)).toBe(
        true,
      );
    }
  });

  it('runs around a wall that is in the way', () => {
    // given
    const { blocked, width, height } = parse([
      '.....',
      '.###.',
      '.###.',
      '.....',
    ]);

    // when
    const route =
      findRockRoute(width, height, blocked, { x: 2, y: 0 }, { x: 2, y: 3 }) ??
      [];

    // then
    expect(route.length).toBeGreaterThan(4);
    expect(route.every(({ x, y }) => blocked[y * width + x] === 0)).toBe(true);
  });

  it('finds no route when the ends are walled off from each other', () => {
    // given
    const { blocked, width, height } = parse(['..#..', '..#..', '..#..']);

    // when
    const route = findRockRoute(
      width,
      height,
      blocked,
      { x: 0, y: 1 },
      { x: 4, y: 1 },
    );

    // then
    expect(route).toBeUndefined();
  });

  it('finds no route from a blocked tile', () => {
    // given
    const { blocked, width, height } = parse(['#....']);

    // when
    const route = findRockRoute(
      width,
      height,
      blocked,
      { x: 0, y: 0 },
      { x: 4, y: 0 },
    );

    // then
    expect(route).toBeUndefined();
  });

  it('finds no route to a tile off the map', () => {
    // given
    const { blocked, width, height } = parse(['.....']);

    // when
    const route = findRockRoute(
      width,
      height,
      blocked,
      { x: 0, y: 0 },
      { x: 9, y: 0 },
    );

    // then
    expect(route).toBeUndefined();
  });

  it('returns the single tile when both ends are the same', () => {
    // given
    const { blocked, width, height } = parse(['...']);

    // when
    const route = findRockRoute(
      width,
      height,
      blocked,
      { x: 1, y: 0 },
      { x: 1, y: 0 },
    );

    // then
    expect(route).toEqual([{ x: 1, y: 0 }]);
  });

  it('runs close to the straight line between the ends over open ground', () => {
    // given
    const { blocked, width, height } = parse(
      Array.from({ length: 11 }, () => '.'.repeat(11)),
    );

    // when
    const route =
      findRockRoute(width, height, blocked, { x: 0, y: 0 }, { x: 10, y: 10 }) ??
      [];

    // then
    expect(route.every(({ x, y }) => Math.abs(x - y) <= 1)).toBe(true);
  });

  it('finds a route through a winding corridor', () => {
    // given
    const { blocked, width, height } = parse([
      '.#...',
      '.#.#.',
      '.#.#.',
      '...#.',
    ]);

    // when
    const route =
      findRockRoute(width, height, blocked, { x: 0, y: 0 }, { x: 4, y: 0 }) ??
      [];

    // then
    expect(route).toHaveLength(11);
  });

  it('finds a route that is exactly as long as the limit', () => {
    // given
    const { blocked, width, height } = parse(['.......']);

    // when
    const route = findRockRoute(
      width,
      height,
      blocked,
      { x: 0, y: 0 },
      { x: 6, y: 0 },
      6,
    );

    // then
    expect(route).toHaveLength(7);
  });

  it('finds no route that is longer than the limit', () => {
    // given
    const { blocked, width, height } = parse([
      '.....',
      '.###.',
      '.###.',
      '.....',
    ]);

    // when
    const route = findRockRoute(
      width,
      height,
      blocked,
      { x: 2, y: 0 },
      { x: 2, y: 3 },
      4,
    );

    // then
    expect(route).toBeUndefined();
  });

  it('finds the same route with a limit that is not reached', () => {
    // given
    const { blocked, width, height } = parse([
      '.....',
      '.###.',
      '.###.',
      '.....',
    ]);

    // when
    const limited = findRockRoute(
      width,
      height,
      blocked,
      { x: 2, y: 0 },
      { x: 2, y: 3 },
      40,
    );
    const free = findRockRoute(
      width,
      height,
      blocked,
      { x: 2, y: 0 },
      { x: 2, y: 3 },
    );

    // then
    expect(limited).toEqual(free);
  });
});
