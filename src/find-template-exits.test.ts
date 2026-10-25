import { describe, expect, it } from 'vitest';
import { findTemplateExits } from './find-template-exits';
import { TemplateCell } from './template-cell';

const {
  Unused: U,
  Floor: F,
  Wall: W,
  Exit: E,
  Door: D,
  OptionalExit: O,
} = TemplateCell;

describe('findTemplateExits', () => {
  it('finds an exit on the template edge', () => {
    // given
    const cells = [
      [W, E, W],
      [W, F, W],
      [W, W, W],
    ];

    // when
    const exits = findTemplateExits(cells);

    // then
    expect(exits).toEqual([{ x: 1, y: 0, kind: E, directions: [0] }]);
  });

  it('finds a door next to an unused cell', () => {
    // given
    const cells = [
      [U, U, U],
      [W, D, W],
      [W, F, W],
      [W, W, W],
    ];

    // when
    const exits = findTemplateExits(cells);

    // then
    expect(exits).toEqual([{ x: 1, y: 1, kind: D, directions: [0] }]);
  });

  it('lists every outside direction of a corner exit', () => {
    // given
    const cells = [
      [E, W],
      [W, F],
    ];

    // when
    const exits = findTemplateExits(cells);

    // then
    expect(exits[0]?.directions).toEqual([0, 3]);
  });

  it('finds an optional exit on the template edge', () => {
    // given
    const cells = [
      [W, O, W],
      [W, F, W],
    ];

    // when
    const exits = findTemplateExits(cells);

    // then
    expect(exits).toEqual([{ x: 1, y: 0, kind: O, directions: [0] }]);
  });

  it('ignores internal doors', () => {
    // given
    const cells = [
      [W, W, W],
      [W, D, W],
      [W, W, W],
    ];

    // when
    const exits = findTemplateExits(cells);

    // then
    expect(exits).toEqual([]);
  });
});
