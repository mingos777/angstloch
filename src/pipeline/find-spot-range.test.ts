import { describe, expect, it } from 'vitest';
import { findSpotRange } from './find-spot-range';

describe('findSpotRange', () => {
  it('spans the whole axis without a window', () => {
    // given
    const window = undefined;

    // when
    const spots = findSpotRange(window, 10, 40);

    // then
    expect(spots).toEqual({ min: 0, max: 30 });
  });

  it.each([
    ['left', 5, 15],
    ['top', 5, 15],
    ['right', 1, 11],
    ['bottom', 1, 11],
    ['center', 3, 13],
  ])('puts the %s anchor of the box in the window', (anchor, min, max) => {
    // given
    const window = { min: 5, max: 15, anchor };

    // when
    const spots = findSpotRange(window, 5, 40);

    // then
    expect(spots).toEqual({ min, max });
  });

  it('anchors at the center by default', () => {
    // given
    const window = { min: 10, max: 10 };

    // when
    const spots = findSpotRange(window, 6, 40);

    // then
    expect(spots).toEqual({ min: 7, max: 7 });
  });

  it('keeps the box on the map', () => {
    // given
    const window = { min: -10, max: 50, anchor: 'left' };

    // when
    const spots = findSpotRange(window, 10, 40);

    // then
    expect(spots).toEqual({ min: 0, max: 30 });
  });

  it('is empty when no spot puts the anchor in the window', () => {
    // given
    const window = { min: 2, max: 3, anchor: 'right' };

    // when
    const spots = findSpotRange(window, 10, 40);

    // then
    expect(spots.min).toBeGreaterThan(spots.max);
  });
});
