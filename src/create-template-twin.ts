import type { Transform } from './create-transforms';
import { findTemplateExits } from './find-template-exits';
import type { Rotation } from './rotation';
import { TemplateCell } from './template-cell';
import type { TemplatePlacement } from './template-placement';

/**
 * The mirror image of a placement under a transform of the map: the same
 * variant, flipped or turned half way around, wherever it lands.
 */
export function createTemplateTwin(
  placement: TemplatePlacement,
  transform: Transform,
): TemplatePlacement {
  const { x, y, width, height } = placement;
  const box = transform.room({
    id: 0,
    x,
    y,
    width,
    height,
    exits: [],
    exitCount: 0,
    doorCount: 0,
  });
  const cells = Array.from({ length: height }, () =>
    Array<TemplateCell>(width).fill(TemplateCell.Unused),
  );
  placement.cells.forEach((row, dy) => {
    row.forEach((cell, dx) => {
      const image = transform.point({ x: x + dx, y: y + dy });
      const target = cells[image.y - box.y];
      if (target) {
        target[image.x - box.x] = cell;
      }
    });
  });

  const flipX = transform.direction(1) === 3;
  const flipY = transform.direction(0) === 2;
  const turned = (degrees: number): Rotation =>
    (((degrees % 360) + 360) % 360) as Rotation;
  // flipping a variant undoes its rotation and toggles its mirroring
  const rotation =
    flipX === flipY
      ? turned(placement.rotation + (flipX ? 180 : 0))
      : turned((flipY ? 180 : 0) - placement.rotation);
  return {
    x: box.x,
    y: box.y,
    width,
    height,
    cells,
    exits: findTemplateExits(cells),
    rotation,
    mirrored: flipX === flipY ? placement.mirrored : !placement.mirrored,
  };
}
