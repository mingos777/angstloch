import { describe, expect, it } from 'vitest';
import { smoothPath } from './smooth-path';

describe('smoothPath', () => {
  it('straightens an L-shaped path', () => {
    // given
    const path = [
      ...Array.from({ length: 9 }, (_, x) => ({ x, y: 0 })),
      ...Array.from({ length: 8 }, (_, y) => ({ x: 8, y: y + 1 })),
    ];

    // when
    const smooth = smoothPath(path, new Uint8Array(81), 9, 9);

    // then: the corner is cut, so the path is no longer than before
    expect(smooth.length).toBeLessThanOrEqual(path.length);
    expect(smooth.some(({ x, y }) => x === 4 && y === 4)).toBe(true);
  });

  it('keeps off blocked tiles and keeps its ends', () => {
    // given
    const path = [
      ...Array.from({ length: 9 }, (_, x) => ({ x, y: 0 })),
      ...Array.from({ length: 8 }, (_, y) => ({ x: 8, y: y + 1 })),
    ];
    const blocked = new Uint8Array(81);
    blocked[4 * 9 + 4] = 1;

    // when
    const smooth = smoothPath(path, blocked, 9, 9);

    // then
    expect(smooth[0]).toEqual({ x: 0, y: 0 });
    expect(smooth[smooth.length - 1]).toEqual({ x: 8, y: 8 });
    expect(smooth.some(({ x, y }) => x === 4 && y === 4)).toBe(false);
  });
});
