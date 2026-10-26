import { describe, expect, it } from 'vitest';
import { assertLayoutSymmetry } from './assert-layout-symmetry';

describe('assertLayoutSymmetry', () => {
  it.each(['none', 'horizontal', 'vertical', 'both', 'rotational'])(
    'accepts %s',
    (symmetry) => {
      // given
      const check = () => {
        assertLayoutSymmetry('layoutSymmetry', symmetry);
      };

      // when / then
      expect(check).not.toThrow();
    },
  );

  it('throws a RangeError that names the option and the value', () => {
    // given
    const check = () => {
      assertLayoutSymmetry('layoutSymmetry', 'diagonal');
    };

    // when / then
    expect(check).toThrow(RangeError);
    expect(check).toThrow('layoutSymmetry must be one of');
    expect(check).toThrow('got diagonal');
  });
});
