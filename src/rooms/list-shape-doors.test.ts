import { describe, expect, it } from 'vitest';
import { listShapeDoors } from './list-shape-doors';
import { TemplateCell } from './templates/template-cell';
import type { TemplatePlacement } from './templates/template-placement';

const { Wall: W, Exit: E, Door: D, Floor: F, OptionalExit: O } = TemplateCell;

const placement: TemplatePlacement = {
  x: 2,
  y: 1,
  width: 5,
  height: 1,
  cells: [[E, D, O, F, W]],
  exits: [],
  rotation: 0,
  mirrored: false,
};

describe('listShapeDoors', () => {
  it('lists the decisions of exit, door and optional exit cells in map coordinates', () => {
    // given
    const doors = new Map([
      [12, true],
      [13, true],
      [14, false],
    ]);

    // when
    const listed = listShapeDoors(placement, doors, 10);

    // then
    expect(listed).toEqual([
      { x: 2, y: 1, door: true },
      { x: 3, y: 1, door: true },
      { x: 4, y: 1, door: false },
    ]);
  });

  it('leaves out the cells that were not decided', () => {
    // given
    const doors = new Map([[13, true]]);

    // when
    const listed = listShapeDoors(placement, doors, 10);

    // then
    expect(listed).toEqual([{ x: 3, y: 1, door: true }]);
  });

  it('leaves out floor and wall cells, whatever the decisions say', () => {
    // given
    const doors = new Map([
      [15, true],
      [16, true],
    ]);

    // when
    const listed = listShapeDoors(placement, doors, 10);

    // then
    expect(listed).toEqual([]);
  });
});
