import { describe, expect, it } from 'vitest';
import { assertDimensions } from './assert-dimensions';

describe('assertDimensions', () => {
  it('accepts integers of at least the minimum', () => {
    // given
    const check = () => {
      assertDimensions(3, 7, 3);
    };

    // when / then
    expect(check).not.toThrow();
  });

  it('rejects a width below the minimum', () => {
    // given
    const check = () => {
      assertDimensions(2, 7, 3);
    };

    // when / then
    expect(check).toThrow(/width/);
  });

  it('rejects a fractional height', () => {
    // given
    const check = () => {
      assertDimensions(7, 7.5);
    };

    // when / then
    expect(check).toThrow(/height/);
  });
});
