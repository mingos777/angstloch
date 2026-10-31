import { describe, expect, it } from 'vitest';
import { mulberry32 } from '../test-helpers/mulberry32';
import type { CisternSide } from './cistern-side';
import { pickLedges } from './pick-ledges';

const ROUND: CisternSide[] = ['top', 'right', 'bottom', 'left'];

/** Whether the sides follow one another round a box, with no gap. */
function isRun(sides: readonly CisternSide[]): boolean {
  const gaps = ROUND.filter(
    (side, index) =>
      sides.includes(side) &&
      !sides.includes(ROUND[(index + 1) % 4] as CisternSide),
  );
  return gaps.length <= 1;
}

describe('pickLedges', () => {
  it('picks as many sides as drawn, next to each other', () => {
    // given
    const random = mulberry32(1);

    // when
    const picks = Array.from({ length: 40 }, () =>
      pickLedges(random, { min: 1, max: 4 }, []),
    );

    // then
    expect(new Set(picks.map((sides) => sides.length))).toEqual(
      new Set([1, 2, 3, 4]),
    );
    expect(picks.every(isRun)).toBe(true);
  });

  it('always holds the sides needed', () => {
    // given
    const random = mulberry32(2);

    // when
    const picks = Array.from({ length: 40 }, () =>
      pickLedges(random, { min: 1, max: 4 }, ['left']),
    );

    // then
    expect(picks.every((sides) => sides.includes('left'))).toBe(true);
    expect(picks.every(isRun)).toBe(true);
  });

  it('raises the count to join two opposite sides needed through a third', () => {
    // given
    const random = mulberry32(3);

    // when
    const picks = Array.from({ length: 20 }, () =>
      pickLedges(random, { min: 1, max: 1 }, ['top', 'bottom']),
    );

    // then
    for (const sides of picks) {
      expect(sides).toHaveLength(3);
      expect(sides).toEqual(expect.arrayContaining(['top', 'bottom']));
      expect(isRun(sides)).toBe(true);
    }
  });
});
