import { describe, expect, it } from 'vitest';
import { createTransforms } from './create-transforms';
import type { Room } from './room';

const room: Room = {
  id: 4,
  x: 2,
  y: 3,
  width: 5,
  height: 3,
  exits: [1],
  exitCount: 1,
  doorCount: 1,
};

describe('createTransforms', () => {
  it.each([
    ['none', 0],
    ['horizontal', 1],
    ['vertical', 1],
    ['rotational', 1],
    ['both', 3],
  ] as const)(
    'makes the right number of transforms for %s',
    (symmetry, count) => {
      // given
      const size = [21, 11] as const;

      // when
      const transforms = createTransforms(symmetry, ...size, false);

      // then
      expect(transforms).toHaveLength(count);
    },
  );

  it('mirrors tiles from left to right for horizontal symmetry', () => {
    // given
    const [transform] = createTransforms('horizontal', 21, 11, false);

    // when
    const image = transform?.point({ x: 2, y: 3 });

    // then
    expect(image).toEqual({ x: 18, y: 3 });
  });

  it('mirrors tiles from top to bottom for vertical symmetry', () => {
    // given
    const [transform] = createTransforms('vertical', 21, 11, false);

    // when
    const image = transform?.point({ x: 2, y: 3 });

    // then
    expect(image).toEqual({ x: 2, y: 7 });
  });

  it('turns tiles around the center for rotational symmetry', () => {
    // given
    const [transform] = createTransforms('rotational', 21, 11, false);

    // when
    const image = transform?.point({ x: 2, y: 3 });

    // then
    expect(image).toEqual({ x: 18, y: 7 });
  });

  it('treats an even lattice size as the odd size below it', () => {
    // given
    const [transform] = createTransforms('horizontal', 20, 10, true);

    // when
    const image = transform?.point({ x: 1, y: 1 });

    // then
    expect(image).toEqual({ x: 17, y: 1 });
  });

  it('uses the full even size when there is no lattice', () => {
    // given
    const [transform] = createTransforms('horizontal', 20, 10, false);

    // when
    const image = transform?.point({ x: 1, y: 1 });

    // then
    expect(image).toEqual({ x: 18, y: 1 });
  });

  it('mirrors a room so that it covers the mirrored tiles', () => {
    // given
    const [transform] = createTransforms('horizontal', 21, 11, false);

    // when
    const image = transform?.room(room);

    // then
    expect(image).toMatchObject({ x: 14, y: 3, width: 5, height: 3 });
    expect(image?.exits).toEqual([]);
  });

  it.each([
    ['horizontal', [0, 3, 2, 1]],
    ['vertical', [2, 1, 0, 3]],
    ['rotational', [2, 3, 0, 1]],
  ] as const)('maps directions for %s symmetry', (symmetry, expected) => {
    // given
    const [transform] = createTransforms(symmetry, 21, 11, false);

    // when
    const images = [0, 1, 2, 3].map((d) => transform?.direction(d));

    // then
    expect(images).toEqual(expected);
  });

  it('maps every tile onto itself when a transform is applied twice', () => {
    // given
    const transforms = createTransforms('both', 20, 12, true);

    // when
    const images = transforms.map((t) => t.point(t.point({ x: 3, y: 5 })));

    // then
    expect(images).toEqual(transforms.map(() => ({ x: 3, y: 5 })));
  });
});
