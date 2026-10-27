import { describe, expect, it } from 'vitest';
import { curveTiles } from './curve-tiles';

describe('curveTiles', () => {
  it('runs from one tile to the other', () => {
    // given
    const from = { x: 2, y: 3 };
    const to = { x: 20, y: 12 };

    // when
    const tiles = curveTiles(from, to, 0, Math.PI / 2);

    // then
    expect(tiles[0]).toEqual(from);
    expect(tiles[tiles.length - 1]).toEqual(to);
  });

  it('steps along edges only', () => {
    // given
    const from = { x: 2, y: 3 };
    const to = { x: 20, y: 12 };

    // when
    const tiles = curveTiles(from, to, 0, Math.PI / 2);

    // then
    const jumps = tiles.filter(
      (tile, at) =>
        at > 0 &&
        Math.abs(tile.x - (tiles[at - 1]?.x ?? 0)) +
          Math.abs(tile.y - (tiles[at - 1]?.y ?? 0)) !==
          1,
    );
    expect(jumps).toEqual([]);
  });

  it('leaves in the direction asked for', () => {
    // given
    const from = { x: 10, y: 10 };
    const to = { x: 30, y: 10 };

    // when
    const tiles = curveTiles(from, to, Math.PI / 2, Math.PI / 2);

    // then: it sets off downwards although the target is to the right
    expect(tiles[2]?.y).toBeGreaterThan(10);
  });

  it('pushes the curve to the right of its way by the sway', () => {
    // given
    const from = { x: 0, y: 10 };
    const to = { x: 20, y: 10 };

    // when
    const tiles = curveTiles(from, to, 0, 0, (t) => 3 * Math.sin(Math.PI * t));

    // then
    expect(tiles.find(({ x }) => x === 10)?.y).toBe(13);
  });

  it('swings wider with a higher tension', () => {
    // given
    const from = { x: 0, y: 0 };
    const to = { x: 20, y: 0 };
    const widest = (tension: number) =>
      Math.max(
        ...curveTiles(
          from,
          to,
          Math.PI / 2,
          -Math.PI / 2,
          undefined,
          tension,
        ).map(({ y }) => y),
      );

    // when
    const tight = widest(0.5);
    const wide = widest(1.5);

    // then
    expect(wide).toBeGreaterThan(tight);
  });
});
