import { describe, expect, it } from 'vitest';
import { createTransforms } from './create-transforms';
import { decideTemplateDoors } from './decide-template-doors';
import { TemplateCell } from './template-cell';
import type { TemplatePlacement } from './template-placement';

const { Wall: W, Exit: E, Door: D, Floor: F } = TemplateCell;

function placement(x: number, cells: TemplateCell[][]): TemplatePlacement {
  return {
    x,
    y: 0,
    width: cells[0]?.length ?? 0,
    height: cells.length,
    cells,
    exits: [],
    rotation: 0,
    mirrored: false,
  };
}

describe('decideTemplateDoors', () => {
  it('always gives a door to door cells', () => {
    // given
    const shape = placement(0, [[W, D, W]]);

    // when
    const doors = decideTemplateDoors(() => 0.99, [shape], [], 0, 10);

    // then
    expect(doors.get(1)).toBe(true);
  });

  it('gives a door to exit cells by the chance', () => {
    // given
    const shape = placement(0, [[W, E, W, E, F]]);
    const rolls = [0.1, 0.9];

    // when
    const doors = decideTemplateDoors(
      () => rolls.shift() ?? 0,
      [shape],
      [],
      0.5,
      10,
    );

    // then
    expect([doors.get(1), doors.get(3)]).toEqual([true, false]);
  });

  it('ignores cells that are not exits or doors', () => {
    // given
    const shape = placement(0, [[W, F, W]]);

    // when
    const doors = decideTemplateDoors(() => 0, [shape], [], 1, 10);

    // then
    expect(doors.size).toBe(0);
  });

  it('gives a mirror image the answer of the cell it mirrors', () => {
    // given
    const left = placement(1, [[E]]);
    const right = placement(8, [[E]]);
    const transforms = createTransforms('horizontal', 10, 3, false);
    const rolls = [0.1, 0.9];

    // when
    const doors = decideTemplateDoors(
      () => rolls.shift() ?? 0,
      [left, right],
      transforms,
      0.5,
      10,
    );

    // then
    expect([doors.get(1), doors.get(8)]).toEqual([true, true]);
  });
});
