import { describe, expect, it } from 'vitest';
import { extendPastBorder } from './extend-past-border';
import { traceTiles } from './trace-tiles';

describe('extendPastBorder', () => {
  it('adds nothing to a road that ends inside the map', () => {
    // given
    const points = traceTiles({ x: 3, y: 5 }, { x: 7, y: 5 });

    // when
    const beyond = extendPastBorder(points, 11, 11);

    // then
    expect(beyond).toEqual([]);
  });

  it('carries a road straight on past the border it leaves across', () => {
    // given
    const points = traceTiles({ x: 5, y: 5 }, { x: 0, y: 5 });

    // when
    const beyond = extendPastBorder(points, 11, 11);

    // then
    expect(beyond).toEqual([
      { x: -1, y: 5 },
      { x: -2, y: 5 },
    ]);
  });

  it('carries a diagonal road on diagonally', () => {
    // given
    const points = traceTiles({ x: 6, y: 4 }, { x: 10, y: 0 });

    // when
    const beyond = extendPastBorder(points, 11, 11);

    // then
    expect(beyond).toEqual([
      { x: 11, y: -1 },
      { x: 12, y: -2 },
    ]);
  });

  it('carries on past the border at both ends', () => {
    // given
    const points = traceTiles({ x: 0, y: 5 }, { x: 10, y: 5 });

    // when
    const beyond = extendPastBorder(points, 11, 11);

    // then
    expect(beyond).toEqual([
      { x: -1, y: 5 },
      { x: -2, y: 5 },
      { x: 11, y: 5 },
      { x: 12, y: 5 },
    ]);
  });

  it('takes a road that runs along the border straight out', () => {
    // given
    const points = traceTiles({ x: 2, y: 10 }, { x: 8, y: 10 });

    // when
    const beyond = extendPastBorder(points, 11, 11);

    // then
    expect(beyond).toEqual([
      { x: 2, y: 11 },
      { x: 2, y: 12 },
      { x: 8, y: 11 },
      { x: 8, y: 12 },
    ]);
  });

  it('tapers a road that leaves at a shallow angle along the border, off the map', () => {
    // given
    const points = traceTiles({ x: 3, y: 8 }, { x: 0, y: 2 });

    // when
    const beyond = extendPastBorder(points, 11, 11);

    // then
    expect(beyond).toEqual([
      { x: -1, y: 1 },
      { x: -1, y: 0 },
      { x: -2, y: -1 },
      { x: -2, y: -2 },
    ]);
  });

  it('takes a road that runs almost along the border out at the steepest drift', () => {
    // given
    const points = traceTiles({ x: 1, y: 9 }, { x: 0, y: 2 });

    // when
    const beyond = extendPastBorder(points, 11, 11);

    // then
    expect(beyond).toHaveLength(8);
    expect(beyond[beyond.length - 1]).toEqual({ x: -2, y: -6 });
  });

  it('adds nothing to a road of a single tile inside the map', () => {
    // given
    const points = [{ x: 5, y: 5 }];

    // when
    const beyond = extendPastBorder(points, 11, 11);

    // then
    expect(beyond).toEqual([]);
  });
});
