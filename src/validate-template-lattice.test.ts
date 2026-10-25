import { describe, expect, it } from 'vitest';
import type { RoomTemplate } from './room-template';
import { TemplateCell } from './template-cell';
import { validateTemplateLattice } from './validate-template-lattice';

const { Unused: U, Floor: F, Wall: W, Exit: E, OptionalExit: O } = TemplateCell;

const closet: RoomTemplate = {
  name: 'closet',
  cells: [
    [W, E, W],
    [W, F, W],
    [W, W, W],
  ],
};

function check(template: RoomTemplate) {
  return () => {
    validateTemplateLattice(template, 2);
  };
}

describe('validateTemplateLattice', () => {
  it('accepts a template whose exits face odd tiles', () => {
    // given
    const template = closet;

    // when / then
    expect(check(template)).not.toThrow();
  });

  it('rejects even dimensions', () => {
    // given
    const template: RoomTemplate = {
      cells: [
        [W, E, W, W],
        [W, F, F, W],
        [W, W, W, W],
      ],
    };

    // when / then
    expect(check(template)).toThrow(/Template #2.*lattice/);
  });

  it('rejects an exit that faces an even tile', () => {
    // given
    const template: RoomTemplate = {
      name: 'cross',
      cells: [
        [U, W, E, W, U],
        [W, W, F, W, W],
        [W, F, F, F, W],
        [W, W, F, W, W],
        [U, W, W, W, U],
      ],
    };

    // when / then
    expect(check(template)).toThrow(/"cross"/);
  });

  it('rejects a template with a fixed exit on an even tile and another on an odd one', () => {
    // given
    const template: RoomTemplate = {
      cells: [
        [W, E, W, E, W, W],
        [W, F, F, F, F, W],
        [W, W, W, W, W, W],
      ],
    };

    // when / then
    expect(check(template)).toThrow(/lattice/);
  });

  it('accepts an optional exit that faces an even tile next to a good one', () => {
    // given
    const template: RoomTemplate = {
      cells: [
        [W, E, W, O, W, W, W],
        [W, F, F, F, F, F, W],
        [W, W, W, W, W, W, W],
      ],
    };

    // when / then
    expect(check(template)).not.toThrow();
  });
});
