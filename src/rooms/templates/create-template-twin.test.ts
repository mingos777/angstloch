import { describe, expect, it } from 'vitest';
import { createTemplateTwin } from './create-template-twin';
import { createTransforms } from './create-transforms';
import type { Transform } from './create-transforms';
import type { LayoutSymmetry } from '../../core/layout-symmetry';
import { findTemplateExits } from './find-template-exits';
import { TemplateCell } from './template-cell';
import type { TemplatePlacement } from './template-placement';

const { Unused: U, Floor: F, Wall: W, Exit: E } = TemplateCell;

const cells = [
  [W, W, E, W],
  [W, F, F, W],
  [U, W, W, W],
];

function transformOf(symmetry: LayoutSymmetry): Transform {
  const [transform] = createTransforms(symmetry, 21, 11, false);
  if (!transform) {
    throw new Error('no transform');
  }
  return transform;
}

function placement(rotation: 0 | 90 | 180 | 270 = 0): TemplatePlacement {
  return {
    x: 2,
    y: 1,
    width: 4,
    height: 3,
    cells,
    exits: findTemplateExits(cells),
    rotation,
    mirrored: false,
  };
}

describe('createTemplateTwin', () => {
  it('mirrors the cells and the position', () => {
    // given
    const transform = transformOf('horizontal');

    // when
    const twin = createTemplateTwin(placement(), transform);

    // then
    expect(twin.x).toBe(15);
    expect(twin.y).toBe(1);
    expect(twin.cells).toEqual([
      [W, E, W, W],
      [W, F, F, W],
      [W, W, W, U],
    ]);
  });

  it('finds the exits of the image', () => {
    // given
    const transform = transformOf('vertical');

    // when
    const twin = createTemplateTwin(placement(), transform);

    // then
    expect(twin.exits).toEqual([{ x: 2, y: 2, kind: E, directions: [2] }]);
  });

  it('turns half way around for rotational symmetry', () => {
    // given
    const transform = transformOf('rotational');

    // when
    const twin = createTemplateTwin(placement(90), transform);

    // then
    expect(twin.cells[0]).toEqual([W, W, W, U]);
    expect([twin.rotation, twin.mirrored]).toEqual([270, false]);
  });

  it('toggles mirroring and undoes the rotation when flipping', () => {
    // given
    const transform = transformOf('horizontal');

    // when
    const twin = createTemplateTwin(placement(90), transform);

    // then
    expect([twin.rotation, twin.mirrored]).toEqual([270, true]);
  });

  it('flips vertically as a half turn of a mirror image', () => {
    // given
    const transform = transformOf('vertical');

    // when
    const twin = createTemplateTwin(placement(90), transform);

    // then
    expect([twin.rotation, twin.mirrored]).toEqual([90, true]);
  });
});
