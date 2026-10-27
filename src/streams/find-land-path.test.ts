import { describe, expect, it } from 'vitest';
import { findLandPath } from './find-land-path';

describe('findLandPath', () => {
  it('goes round a blocked wall by the shortest way', () => {
    // given
    const blocked = new Uint8Array(25);
    for (let y = 0; y < 4; ++y) {
      blocked[y * 5 + 2] = 1;
    }

    // when
    const path = findLandPath({ x: 0, y: 0 }, { x: 4, y: 0 }, blocked, 5, 5);

    // then
    expect(path).toHaveLength(13);
    expect(path?.some(({ x, y }) => x === 2 && y < 4)).toBe(false);
  });

  it('finds no path when the tile is walled in', () => {
    // given
    const blocked = new Uint8Array(25);
    for (let y = 0; y < 5; ++y) {
      blocked[y * 5 + 2] = 1;
    }

    // when
    const path = findLandPath({ x: 0, y: 0 }, { x: 4, y: 0 }, blocked, 5, 5);

    // then
    expect(path).toBeUndefined();
  });

  it('keeps near the straight line on open ground', () => {
    // given
    const blocked = new Uint8Array(121);

    // when
    const path = findLandPath(
      { x: 0, y: 0 },
      { x: 10, y: 10 },
      blocked,
      11,
      11,
    );

    // then
    expect(path?.every(({ x, y }) => Math.abs(x - y) <= 1)).toBe(true);
  });

  it('steps along edges only', () => {
    // given
    const blocked = new Uint8Array(121);

    // when
    const path =
      findLandPath({ x: 0, y: 0 }, { x: 10, y: 7 }, blocked, 11, 11) ?? [];

    // then
    const jumps = path.filter(
      (tile, at) =>
        at > 0 &&
        Math.abs(tile.x - (path[at - 1]?.x ?? 0)) +
          Math.abs(tile.y - (path[at - 1]?.y ?? 0)) !==
          1,
    );
    expect(jumps).toEqual([]);
  });

  it('never cuts the corner of a blocked tile', () => {
    // given: two tiles that touch only at a corner leave no way between them
    const blocked = new Uint8Array(9);
    blocked[1] = 1;
    blocked[3] = 1;

    // when
    const path = findLandPath({ x: 0, y: 0 }, { x: 1, y: 1 }, blocked, 3, 3);

    // then
    expect(path).toBeUndefined();
  });
});
