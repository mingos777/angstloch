import { describe, expect, it } from 'vitest';
import { assertVerge } from './assert-verge';

describe('assertVerge', () => {
  it('accepts an empty verge', () => {
    // given
    const verge = {};

    // when
    const call = () => {
      assertVerge('verge', verge);
    };

    // then
    expect(call).not.toThrow();
  });

  it('throws a RangeError naming the option for a bad clearance', () => {
    // given
    const verge = { clearance: -1 };

    // when
    const call = () => {
      assertVerge('streams.verge', verge);
    };

    // then
    expect(call).toThrow(RangeError);
    expect(call).toThrow(/streams\.verge\.clearance/);
  });

  it('throws a RangeError for a fractional falloff', () => {
    // given
    const verge = { falloff: 1.5 };

    // when
    const call = () => {
      assertVerge('verge', verge);
    };

    // then
    expect(call).toThrow(/verge\.falloff/);
  });

  it('throws a RangeError for an unknown distance', () => {
    // given
    const verge = { distance: 'taxicab' as 'manhattan' };

    // when
    const call = () => {
      assertVerge('verge', verge);
    };

    // then
    expect(call).toThrow(RangeError);
  });
});
