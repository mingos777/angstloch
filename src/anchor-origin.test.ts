import { describe, expect, it } from 'vitest';
import { anchorOrigin } from './anchor-origin';
import type { Anchor } from './anchor';

const coords = { x: 20, y: 10 };

describe('anchorOrigin', () => {
  it.each([
    ['center', { x: 18, y: 9 }],
    ['top-left', { x: 20, y: 10 }],
    ['top', { x: 18, y: 10 }],
    ['top-right', { x: 16, y: 10 }],
    ['left', { x: 20, y: 9 }],
    ['right', { x: 16, y: 9 }],
    ['bottom-left', { x: 20, y: 8 }],
    ['bottom', { x: 18, y: 8 }],
    ['bottom-right', { x: 16, y: 8 }],
  ] as [Anchor, { x: number; y: number }][])(
    'puts the %s of a 5x3 box on the coordinates',
    (anchor, expected) => {
      // given
      const position = { coords, anchor };

      // when
      const origin = anchorOrigin(position, 5, 3);

      // then
      expect(origin).toEqual(expected);
    },
  );

  it('rounds the center of an even box down', () => {
    // given
    const position = { coords, anchor: 'center' as const };

    // when
    const origin = anchorOrigin(position, 4, 4);

    // then
    expect(origin).toEqual({ x: 19, y: 9 });
  });
});
