import { describe, expect, it } from 'vitest';
import type { Point } from '../core/point';
import { mulberry32 } from '../test-helpers/mulberry32';
import { ENTRANCE_BAND, pickEntrance } from './pick-entrance';

/** The tiles along the outline of a rectangle. */
function outline(x: number, y: number, width: number, height: number) {
  const tiles: Point[] = [];
  for (let ty = y; ty < y + height; ++ty) {
    for (let tx = x; tx < x + width; ++tx) {
      if (
        tx === x ||
        ty === y ||
        tx === x + width - 1 ||
        ty === y + height - 1
      ) {
        tiles.push({ x: tx, y: ty });
      }
    }
  }
  return tiles;
}

describe('pickEntrance', () => {
  const boundary = outline(0, 0, 21, 21);
  const middle = { x: 10, y: 10 };

  it('picks from the east side when the other hall lies to the east', () => {
    // given
    const random = mulberry32(1);

    // when
    const picks = Array.from({ length: 50 }, () =>
      pickEntrance(random, boundary, middle, { x: 60, y: 10 }, []),
    );

    // then
    expect(picks.every((tile) => tile.x >= 20 - ENTRANCE_BAND)).toBe(true);
  });

  it('picks from the north side when the other hall lies to the north', () => {
    // given
    const random = mulberry32(2);

    // when
    const picks = Array.from({ length: 50 }, () =>
      pickEntrance(random, boundary, middle, { x: 10, y: -40 }, []),
    );

    // then
    expect(picks.every((tile) => tile.y <= ENTRANCE_BAND)).toBe(true);
  });

  it('picks from the corner when the other hall lies diagonally', () => {
    // given
    const random = mulberry32(3);

    // when
    const picks = Array.from({ length: 50 }, () =>
      pickEntrance(random, boundary, middle, { x: 50, y: 50 }, []),
    );

    // then
    const edge = 40 - ENTRANCE_BAND * Math.SQRT2;
    expect(picks.every((tile) => tile.x + tile.y >= edge)).toBe(true);
  });

  it('picks from every side without a hall to face', () => {
    // given
    const random = mulberry32(4);

    // when
    const picks = Array.from({ length: 200 }, () =>
      pickEntrance(random, boundary, middle, undefined, []),
    );

    // then
    expect(picks.some((tile) => tile.x === 0)).toBe(true);
    expect(picks.some((tile) => tile.x === 20)).toBe(true);
    expect(picks.some((tile) => tile.y === 0)).toBe(true);
    expect(picks.some((tile) => tile.y === 20)).toBe(true);
  });

  it('picks only tiles of the boundary it is given', () => {
    // given
    const random = mulberry32(5);

    // when
    const tile = pickEntrance(random, boundary, middle, { x: 60, y: 10 }, []);

    // then
    expect(boundary).toContainEqual(tile);
  });

  it('keeps away from the entrances that are already used', () => {
    // given
    const used = [{ x: 20, y: 10 }];

    // when
    const picks = Array.from({ length: 30 }, (_, seed) =>
      pickEntrance(mulberry32(seed), boundary, middle, { x: 60, y: 10 }, used),
    );

    // then
    expect(
      picks.every((tile) => Math.hypot(tile.x - 20, tile.y - 10) >= 3),
    ).toBe(true);
  });

  it('picks different tiles on repeated calls', () => {
    // given
    const random = mulberry32(6);

    // when
    const picks = new Set(
      Array.from({ length: 50 }, () => {
        const tile = pickEntrance(
          random,
          boundary,
          middle,
          { x: 60, y: 10 },
          [],
        );
        return [tile.x, tile.y].join();
      }),
    );

    // then
    expect(picks.size).toBeGreaterThan(1);
  });

  it('picks from every side when the two middles are the same', () => {
    // given
    const random = mulberry32(7);

    // when
    const tile = pickEntrance(random, boundary, middle, middle, []);

    // then
    expect(boundary).toContainEqual(tile);
  });
});
