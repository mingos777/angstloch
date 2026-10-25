import { describe, expect, it } from 'vitest';
import { createTemplateVariants } from './create-template-variants';
import type { RoomTemplate } from './room-template';
import { TemplateCell } from './template-cell';

const { Floor: F, Wall: W, Exit: E } = TemplateCell;

const asymmetric: RoomTemplate = {
  cells: [
    [W, E, W, W],
    [W, F, F, W],
  ],
};

describe('createTemplateVariants', () => {
  it('returns the template as it is by default', () => {
    // given
    const template = asymmetric;

    // when
    const variants = createTemplateVariants(template);

    // then
    expect(variants).toEqual([
      {
        cells: asymmetric.cells,
        width: 4,
        height: 2,
        rotation: 0,
        mirrored: false,
      },
    ]);
  });

  it('rotates clockwise and swaps the dimensions', () => {
    // given
    const template: RoomTemplate = { ...asymmetric, rotate: [90] };

    // when
    const [variant] = createTemplateVariants(template);

    // then
    expect(variant?.cells).toEqual([
      [W, W],
      [F, E],
      [F, W],
      [W, W],
    ]);
    expect([variant?.width, variant?.height]).toEqual([2, 4]);
  });

  it('mirrors left to right', () => {
    // given
    const template: RoomTemplate = { ...asymmetric, mirror: true };

    // when
    const variants = createTemplateVariants(template);

    // then
    expect(variants[1]).toMatchObject({
      mirrored: true,
      cells: [
        [W, W, E, W],
        [W, F, F, W],
      ],
    });
  });

  it('lists every rotation when all are allowed', () => {
    // given
    const template: RoomTemplate = { ...asymmetric, rotate: [0, 90, 180, 270] };

    // when
    const variants = createTemplateVariants(template);

    // then
    expect(variants.map((variant) => variant.rotation)).toEqual([
      0, 90, 180, 270,
    ]);
  });

  it('narrows the rotations down to the ones requested', () => {
    // given
    const template: RoomTemplate = { ...asymmetric, rotate: [0, 90, 180, 270] };

    // when
    const variants = createTemplateVariants(template, [180]);

    // then
    expect(variants.map((variant) => variant.rotation)).toEqual([180]);
  });

  it('lists look-alike variants once', () => {
    // given
    const template: RoomTemplate = {
      cells: [
        [W, E, W],
        [W, F, W],
        [W, E, W],
      ],
      rotate: [0, 180],
      mirror: true,
    };

    // when
    const variants = createTemplateVariants(template);

    // then
    expect(variants).toHaveLength(1);
  });
});
