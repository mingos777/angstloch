import { describe, expect, it } from 'vitest';
import { assertAreaSize } from './assert-area-size';

describe('assertAreaSize', () => {
  it('accepts the default, which is the whole map', () => {
    // given
    const area = {};

    // when
    const call = () => {
      assertAreaSize(area, { min: 1, max: 1 }, 80, 50);
    };

    // then
    expect(call).not.toThrow();
  });

  it('accepts a smaller area with several copies', () => {
    // given
    const area = { width: { min: 10, max: 20 }, height: { min: 10, max: 20 } };

    // when
    const call = () => {
      assertAreaSize(area, { min: 1, max: 3 }, 80, 50);
    };

    // then
    expect(call).not.toThrow();
  });

  it('accepts a count of 0', () => {
    // given
    const count = { min: 0, max: 1 };

    // when
    const call = () => {
      assertAreaSize({}, count, 80, 50);
    };

    // then
    expect(call).not.toThrow();
  });

  it.each([
    ['a width larger than the map', { width: { min: 10, max: 81 } }],
    ['a height larger than the map', { height: { min: 10, max: 51 } }],
    ['a width of 0', { width: { min: 0, max: 5 } }],
    ['a height that is not whole', { height: { min: 1.5, max: 5 } }],
    ['a width with min above max', { width: { min: 9, max: 5 } }],
  ])('throws a RangeError for %s', (_, area) => {
    // given
    const count = { min: 1, max: 1 };

    // when
    const call = () => {
      assertAreaSize(area, count, 80, 50);
    };

    // then
    expect(call).toThrow(RangeError);
  });

  it('throws a RangeError for a bad count', () => {
    // given
    const count = { min: -1, max: 1 };

    // when
    const call = () => {
      assertAreaSize({}, count, 80, 50);
    };

    // then
    expect(call).toThrow(RangeError);
  });

  it('throws a RangeError for several copies of an area as big as the map', () => {
    // given
    const count = { min: 1, max: 2 };

    // when
    const call = () => {
      assertAreaSize({}, count, 80, 50);
    };

    // then
    expect(call).toThrow(RangeError);
  });

  it('throws a RangeError for several copies when only one side is smaller and every width is the map width', () => {
    // given
    const area = { width: { min: 80, max: 80 }, height: { min: 50, max: 50 } };

    // when
    const call = () => {
      assertAreaSize(area, { min: 1, max: 2 }, 80, 50);
    };

    // then
    expect(call).toThrow(RangeError);
  });
});
