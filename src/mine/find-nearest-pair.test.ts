import { describe, expect, it } from 'vitest';
import { findNearestPair } from './find-nearest-pair';

describe('findNearestPair', () => {
  it('finds the pair of tiles that lie nearest each other', () => {
    // given
    const sources = [
      { x: 0, y: 0 },
      { x: 10, y: 10 },
    ];
    const targets = [
      { x: 30, y: 30 },
      { x: 12, y: 10 },
    ];

    // when
    const pair = findNearestPair(sources, targets);

    // then
    expect(pair?.source).toEqual({ x: 10, y: 10 });
    expect(pair?.target).toEqual({ x: 12, y: 10 });
    expect(pair?.distance).toBe(2);
  });

  it('returns the target as it was given, with its own fields', () => {
    // given
    const targets = [{ x: 3, y: 4, node: 7 }];

    // when
    const pair = findNearestPair([{ x: 0, y: 0 }], targets);

    // then
    expect(pair?.target.node).toBe(7);
    expect(pair?.distance).toBe(5);
  });

  it('finds nothing without sources', () => {
    // given
    const targets = [{ x: 1, y: 1 }];

    // when
    const pair = findNearestPair([], targets);

    // then
    expect(pair).toBeUndefined();
  });

  it('finds nothing without targets', () => {
    // given
    const sources = [{ x: 1, y: 1 }];

    // when
    const pair = findNearestPair(sources, []);

    // then
    expect(pair).toBeUndefined();
  });
});
