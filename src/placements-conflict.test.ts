import { describe, expect, it } from 'vitest';
import { placementsConflict } from './placements-conflict';
import { findTemplateExits } from './find-template-exits';
import { TemplateCell } from './template-cell';
import type { TemplatePlacement } from './template-placement';

const { Unused: U, Floor: F, Wall: W, Exit: E, OptionalExit: O } = TemplateCell;

function placement(x: number, y: number, cells: TemplateCell[][]) {
  return {
    x,
    y,
    width: cells[0]?.length ?? 0,
    height: cells.length,
    cells,
    exits: findTemplateExits(cells),
    rotation: 0,
    mirrored: false,
  } satisfies TemplatePlacement;
}

const block = [
  [W, W],
  [W, W],
];

describe('placementsConflict', () => {
  it('detects overlapping footprints when there must be spacing', () => {
    // given
    const a = placement(0, 0, block);
    const b = placement(1, 1, block);

    // when
    const conflict = placementsConflict(a, b, 2);

    // then
    expect(conflict).toBe(true);
  });

  it('detects footprints closer than the spacing', () => {
    // given
    const a = placement(0, 0, block);
    const b = placement(3, 0, block);

    // when
    const conflict = placementsConflict(a, b, 2);

    // then
    expect(conflict).toBe(true);
  });

  it('allows footprints exactly the spacing apart', () => {
    // given
    const a = placement(0, 0, block);
    const b = placement(3, 0, block);

    // when
    const conflict = placementsConflict(a, b, 1);

    // then
    expect(conflict).toBe(false);
  });

  it('ignores unused cells inside the bounding boxes', () => {
    // given
    const l = [
      [W, W],
      [W, U],
    ];
    const a = placement(0, 0, l);
    const b = placement(1, 1, [[W]]);

    // when
    const conflict = placementsConflict(a, b, 0);

    // then
    expect(conflict).toBe(false);
  });

  it('counts a tile in the unused corner as too close', () => {
    // given
    const l = [
      [W, W],
      [W, U],
    ];
    const a = placement(0, 0, l);
    const b = placement(1, 1, [[W]]);

    // when
    const conflict = placementsConflict(a, b, 2);

    // then
    expect(conflict).toBe(true);
  });

  it('lets rooms share a wall when the spacing is 1', () => {
    // given
    const a = placement(0, 0, block);
    const b = placement(1, 1, block);

    // when
    const conflict = placementsConflict(a, b, 1);

    // then
    expect(conflict).toBe(false);
  });

  it('keeps floors off the wall of another room', () => {
    // given
    const room = [
      [W, W, W],
      [W, F, W],
      [W, W, W],
    ];
    const a = placement(0, 0, room);
    const b = placement(1, 1, room);

    // when
    const conflict = placementsConflict(a, b, 1);

    // then
    expect(conflict).toBe(true);
  });

  it('lets optional exits sit on walls', () => {
    // given
    const a = placement(0, 0, [[W, O, W]]);
    const b = placement(0, 0, [[W, W, W]]);

    // when
    const conflict = placementsConflict(a, b, 1);

    // then
    expect(conflict).toBe(false);
  });

  const left = [
    [W, W, W, W],
    [W, F, F, E],
    [W, W, W, W],
  ];
  const right = [
    [W, W, W, W],
    [E, F, F, W],
    [W, W, W, W],
  ];

  it('lets two rooms share a doorway that faces both ways', () => {
    // given
    const a = placement(0, 0, left);
    const b = placement(3, 0, right);

    // when
    const conflict = placementsConflict(a, b, 1);

    // then
    expect(conflict).toBe(false);
  });

  it('rejects a doorway on the wall of another room', () => {
    // given
    const a = placement(0, 0, left);
    const b = placement(3, 0, [
      [W, W, W, W],
      [W, F, F, W],
      [W, W, W, W],
    ]);

    // when
    const conflict = placementsConflict(a, b, 1);

    // then
    expect(conflict).toBe(true);
  });

  it('rejects doorways that face the same way', () => {
    // given
    const a = placement(0, 0, left);
    const b = placement(3, 0, left);

    // when
    const conflict = placementsConflict(a, b, 1);

    // then
    expect(conflict).toBe(true);
  });
});
