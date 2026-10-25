import { describe, expect, it } from 'vitest';
import { createTemplateBlocker } from './create-template-blocker';
import { findTemplateExits } from './find-template-exits';
import { TemplateCell } from './template-cell';
import type { TemplatePlacement } from './template-placement';

const { Floor: F, Wall: W, Exit: E } = TemplateCell;

const cells = [
  [W, E, W],
  [W, F, W],
  [W, W, W],
];
const placement: TemplatePlacement = {
  x: 10,
  y: 10,
  width: 3,
  height: 3,
  cells,
  exits: findTemplateExits(cells),
  rotation: 0,
  mirrored: false,
};

describe('createTemplateBlocker', () => {
  it('has no test without placements', () => {
    // given
    const placements: TemplatePlacement[] = [];

    // when
    const blocker = createTemplateBlocker(placements, 30, 30, 1);

    // then
    expect(blocker).toBeUndefined();
  });

  it('blocks rooms that overlap the footprint', () => {
    // given
    const blocker = createTemplateBlocker([placement], 30, 30, 1);

    // when
    const blocked = blocker?.({ x: 12, y: 11, width: 3, height: 3 });

    // then
    expect(blocked).toBe(true);
  });

  it('blocks rooms whose floor is within the spacing', () => {
    // given
    const blocker = createTemplateBlocker([placement], 30, 30, 1);

    // when
    const blocked = blocker?.({ x: 13, y: 11, width: 3, height: 3 });

    // then
    expect(blocked).toBe(true);
  });

  it('allows rooms the spacing away', () => {
    // given
    const blocker = createTemplateBlocker([placement], 30, 30, 1);

    // when
    const blocked = blocker?.({ x: 14, y: 11, width: 3, height: 3 });

    // then
    expect(blocked).toBe(false);
  });

  it('blocks the tile in front of an exit and its surroundings', () => {
    // given
    const blocker = createTemplateBlocker([placement], 30, 30, 1);

    // when
    const blocked = blocker?.({ x: 10, y: 6, width: 3, height: 3 });

    // then
    expect(blocked).toBe(true);
  });
});
