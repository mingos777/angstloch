import { describe, expect, it } from 'vitest';
import { retryPlacement } from './retry-placement';
import { TemplatePlacementError } from './template-placement-error';

describe('retryPlacement', () => {
  it('returns the first map that is built', () => {
    // given
    let calls = 0;

    // when
    const result = retryPlacement(() => {
      ++calls;
      return 'map';
    });

    // then
    expect(result).toBe('map');
    expect(calls).toBe(1);
  });

  it('builds a new map when a template finds no place', () => {
    // given
    let calls = 0;
    const build = (): string => {
      if (++calls < 3) {
        throw new TemplatePlacementError(0, undefined, 'no free spot');
      }
      return 'map';
    };

    // when
    const result = retryPlacement(build);

    // then
    expect(result).toBe('map');
    expect(calls).toBe(3);
  });

  it('throws the last error after three maps fail', () => {
    // given
    let calls = 0;
    const build = (): never => {
      throw new TemplatePlacementError(0, undefined, `try ${String(++calls)}`);
    };

    // when
    const attempt = (): never => retryPlacement(build);

    // then
    expect(attempt).toThrow('Template #0: try 3');
    expect(calls).toBe(3);
  });

  it('throws a permanent error at once', () => {
    // given
    let calls = 0;
    const build = (): never => {
      ++calls;
      throw new TemplatePlacementError(0, undefined, 'too big', true);
    };

    // when
    const attempt = (): never => retryPlacement(build);

    // then
    expect(attempt).toThrow(TemplatePlacementError);
    expect(calls).toBe(1);
  });

  it('does not catch other errors', () => {
    // given
    let calls = 0;
    const build = (): never => {
      ++calls;
      throw new RangeError('bad option');
    };

    // when
    const attempt = (): never => retryPlacement(build);

    // then
    expect(attempt).toThrow(RangeError);
    expect(calls).toBe(1);
  });
});
