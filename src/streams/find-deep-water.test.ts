import { describe, expect, it } from 'vitest';
import type { Road } from '../roads/road';
import { findDeepWater } from './find-deep-water';

/** A stream of the given width along the middle row of a map 9 tiles wide. */
function stream(width: number): Road {
  return {
    kind: 'road',
    width,
    points: [...Array(9).keys()].map((x) => ({ x, y: 4 })),
  };
}

/** The rows of a map 9 tiles wide and 9 tall that have deep water in the middle column. */
const rowsOf = (deep: Uint8Array) =>
  [...Array(9).keys()].filter((row) => deep[row * 9 + 4] === 1);

describe('findDeepWater', () => {
  it('leaves a band of deep water in the middle of a stream of width 3', () => {
    // given
    const streams = [stream(3)];

    // when
    const deep = findDeepWater(streams, 9, 9, 1);

    // then
    expect(rowsOf(deep)).toEqual([4]);
  });

  it.each([1, 2])('leaves a stream of width %i all shallow', (width) => {
    // given
    const streams = [stream(width)];

    // when
    const deep = findDeepWater(streams, 9, 9, 1);

    // then
    expect(rowsOf(deep)).toEqual([]);
  });

  it('widens the deep band of a wider stream', () => {
    // given
    const streams = [stream(5)];

    // when
    const deep = findDeepWater(streams, 9, 9, 1);

    // then
    expect(rowsOf(deep)).toEqual([3, 4, 5]);
  });

  it('makes the whole stream deep with a shore width of 0', () => {
    // given
    const streams = [stream(3)];

    // when
    const deep = findDeepWater(streams, 9, 9, 0);

    // then
    expect(rowsOf(deep)).toEqual([3, 4, 5]);
  });

  it('widens the shallow banks with the shore width', () => {
    // given
    const streams = [stream(5)];

    // when
    const deep = findDeepWater(streams, 9, 9, 2);

    // then
    expect(rowsOf(deep)).toEqual([4]);
  });

  it('keeps the deep water to the length of the stream, edge to edge', () => {
    // given
    const streams = [stream(3)];

    // when
    const deep = findDeepWater(streams, 9, 9, 1);

    // then
    expect(deep[4 * 9]).toBe(1);
    expect(deep[4 * 9 + 8]).toBe(1);
  });

  it('never makes dry land deep', () => {
    // given
    const streams = [stream(3)];

    // when
    const deep = findDeepWater(streams, 9, 9, 1);

    // then
    expect(deep[0]).toBe(0);
  });

  it('is empty without streams', () => {
    // given
    const streams: Road[] = [];

    // when
    const deep = findDeepWater(streams, 9, 9, 1);

    // then
    expect(deep.every((tile) => tile === 0)).toBe(true);
  });
});
