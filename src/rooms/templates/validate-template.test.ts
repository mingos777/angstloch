import { describe, expect, it } from 'vitest';
import type { RoomTemplate } from './room-template';
import { TemplateCell } from './template-cell';
import { validateTemplate } from './validate-template';

const { Unused: U, Floor: F, Wall: W, Exit: E, OptionalExit: O } = TemplateCell;

const valid: RoomTemplate = {
  name: 'cell',
  cells: [
    [W, E, W],
    [W, F, W],
    [W, W, W],
  ],
};

function check(changes: Partial<RoomTemplate>) {
  return () => {
    validateTemplate({ ...valid, ...changes }, 3);
  };
}

describe('validateTemplate', () => {
  it('accepts a valid template', () => {
    // given
    const template = valid;

    // when / then
    expect(() => {
      validateTemplate(template, 0);
    }).not.toThrow();
  });

  it('names the template in the error', () => {
    // given
    const cells = [] as TemplateCell[][];

    // when / then
    expect(check({ cells })).toThrow(/Template "cell" \(#3\)/);
  });

  it('names an unnamed template by its index', () => {
    // given
    const template: RoomTemplate = { cells: [] };

    // when / then
    expect(() => {
      validateTemplate(template, 5);
    }).toThrow(/Template #5/);
  });

  it('rejects empty cells', () => {
    // given
    const cells = [[]] as TemplateCell[][];

    // when / then
    expect(check({ cells })).toThrow(/empty/);
  });

  it('rejects ragged rows', () => {
    // given
    const cells = [
      [W, E, W],
      [W, W],
    ] as TemplateCell[][];

    // when / then
    expect(check({ cells })).toThrow(/row 1/);
  });

  it('rejects unknown cell values', () => {
    // given
    const cells = [[W, E, 9 as TemplateCell]];

    // when / then
    expect(check({ cells })).toThrow(/unknown cell 9/);
  });

  it('rejects a floor that touches an unused cell', () => {
    // given
    const cells = [
      [W, E, W],
      [W, F, U],
      [W, W, W],
    ];

    // when / then
    expect(check({ cells })).toThrow(/not walled in/);
  });

  it('rejects a floor that touches an unused cell diagonally', () => {
    // given
    const cells = [
      [W, U, W, W],
      [W, W, F, W],
      [W, F, F, W],
      [W, W, E, W],
    ];

    // when / then
    expect(check({ cells })).toThrow(/floor at \(2, 1\)/);
  });

  it('rejects an internal exit that touches an unused cell diagonally', () => {
    // given
    const cells = [
      [W, W, U],
      [W, E, W],
      [W, F, W],
      [W, E, W],
    ];

    // when / then
    expect(check({ cells })).toThrow(/exit at \(1, 1\)/);
  });

  it('accepts a template whose only exits are optional', () => {
    // given
    const cells = [
      [W, O, W],
      [W, F, W],
      [W, W, W],
    ];

    // when / then
    expect(check({ cells })).not.toThrow();
  });

  it('rejects a floor on the template edge', () => {
    // given
    const cells = [
      [W, E, W],
      [F, F, W],
      [W, W, W],
    ];

    // when / then
    expect(check({ cells })).toThrow(/not walled in/);
  });

  it('rejects a template without an exit on its boundary', () => {
    // given
    const cells = [
      [W, W, W],
      [W, E, W],
      [W, W, W],
    ];

    // when / then
    expect(check({ cells })).toThrow(/exit, door or optional exit/);
  });

  it('rejects an invalid count', () => {
    // given
    const count = { min: 3, max: 1 };

    // when / then
    expect(check({ count })).toThrow(/Template "cell".*count/);
  });

  it('rejects an empty rotate list', () => {
    // given
    const rotate: RoomTemplate['rotate'] = [];

    // when / then
    expect(check({ rotate })).toThrow(/rotate/);
  });

  it('rejects an unknown rotation', () => {
    // given
    const rotate = [45] as unknown as RoomTemplate['rotate'];

    // when / then
    expect(check({ rotate })).toThrow(/45/);
  });

  it('rejects an accuracy above 1', () => {
    // given
    const positionAccuracy = 1.5;

    // when / then
    expect(check({ positionAccuracy })).toThrow(/positionAccuracy/);
  });

  it('rejects an unknown anchor', () => {
    // given
    const positions = [
      { coords: { x: 1, y: 1 }, anchor: 'middle' },
    ] as unknown as RoomTemplate['positions'];

    // when / then
    expect(check({ positions })).toThrow(/anchor/);
  });

  it('rejects position rotations that miss the template rotations', () => {
    // given
    const positions: RoomTemplate['positions'] = [
      { coords: { x: 1, y: 1 }, anchor: 'center', rotations: [90] },
    ];

    // when / then
    expect(check({ rotate: [0], positions })).toThrow(/in common/);
  });

  it('accepts position rotations that overlap the template rotations', () => {
    // given
    const positions: RoomTemplate['positions'] = [
      { coords: { x: 1, y: 1 }, anchor: 'center', rotations: [90, 180] },
    ];

    // when / then
    expect(check({ rotate: [0, 90], positions })).not.toThrow();
  });

  it.each([
    [{ x: -1, y: 0, width: 5, height: 5 }, /areas\[0\]\.x/],
    [{ x: 0, y: 0, width: 0, height: 5 }, /areas\[0\]\.width/],
    [{ x: 0, y: 0, width: 5, height: 2.5 }, /areas\[0\]\.height/],
  ])('rejects the area %j', (area, message) => {
    // given
    const areas = [area];

    // when / then
    expect(check({ areas })).toThrow(message);
  });
});
