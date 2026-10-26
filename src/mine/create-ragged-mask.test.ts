import { describe, expect, it } from 'vitest';
import { mulberry32 } from '../test-helpers/mulberry32';
import {
  createRaggedMask,
  MAX_RAGGED_DEPTH,
  raggedDepth,
} from './create-ragged-mask';

function count(mask: Uint8Array): number {
  return mask.reduce((sum, value) => sum + value, 0);
}

describe('raggedDepth', () => {
  it('is 0 for a ragged of 0', () => {
    // given
    const ragged = 0;

    // when
    const depth = raggedDepth(30, ragged);

    // then
    expect(depth).toBe(0);
  });

  it('is capped for a large shape', () => {
    // given
    const ragged = 1;

    // when
    const depth = raggedDepth(100, ragged);

    // then
    expect(depth).toBe(MAX_RAGGED_DEPTH);
  });

  it('leaves a tile of a small shape', () => {
    // given
    const ragged = 1;

    // when
    const depth = raggedDepth(3, ragged);

    // then
    expect(depth).toBe(1);
  });

  it('is 0 for a shape of 2 tiles', () => {
    // given
    const ragged = 1;

    // when
    const depth = raggedDepth(2, ragged);

    // then
    expect(depth).toBe(0);
  });
});

describe('createRaggedMask', () => {
  it('keeps the whole rectangle at a ragged of 0', () => {
    // given
    const random = mulberry32(1);

    // when
    const mask = createRaggedMask(random, 12, 9, 0);

    // then
    expect(count(mask)).toBe(12 * 9);
  });

  it('cuts tiles off the rectangle at a ragged of 1', () => {
    // given
    const random = mulberry32(1);

    // when
    const mask = createRaggedMask(random, 20, 15, 1);

    // then
    expect(count(mask)).toBeLessThan(20 * 15);
  });

  it('keeps the middle of the rectangle', () => {
    // given
    const random = mulberry32(2);

    // when
    const mask = createRaggedMask(random, 20, 15, 1);

    // then
    for (let y = MAX_RAGGED_DEPTH; y < 15 - MAX_RAGGED_DEPTH; ++y) {
      for (let x = MAX_RAGGED_DEPTH; x < 20 - MAX_RAGGED_DEPTH; ++x) {
        expect(mask[y * 20 + x]).toBe(1);
      }
    }
  });

  it('makes the same shape from the same seed', () => {
    // given
    const make = () => createRaggedMask(mulberry32(3), 20, 15, 0.7);

    // when
    const first = make();
    const second = make();

    // then
    expect(first).toEqual(second);
  });

  it('makes one piece of tiles that touch along edges', () => {
    // given
    const masks = Array.from({ length: 30 }, (_, seed) =>
      createRaggedMask(mulberry32(seed + 1), 14, 11, 1),
    );

    // when
    const pieces = masks.map((mask) => {
      const seen = new Set<number>();
      const start = mask.indexOf(1);
      const stack = [start];
      while (stack.length > 0) {
        const at = stack.pop() ?? 0;
        if (seen.has(at) || mask[at] !== 1) {
          continue;
        }
        seen.add(at);
        const x = at % 14;
        if (x > 0) stack.push(at - 1);
        if (x < 13) stack.push(at + 1);
        if (at >= 14) stack.push(at - 14);
        if (at < 14 * 10) stack.push(at + 14);
      }
      return seen.size === count(mask);
    });

    // then
    expect(pieces.every(Boolean)).toBe(true);
  });
});
