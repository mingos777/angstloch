import type { Transform } from './create-transforms';
import type { Random } from '../../core/random';
import { TemplateCell } from './template-cell';
import type { TemplatePlacement } from './template-placement';

/**
 * Decides which `Exit` and `Door` cells of the placements get a door: `Door`
 * cells always do, `Exit` cells by `doorChance`. A cell that is the mirror
 * image of one decided before it gets the same answer. The result is keyed by
 * `y * width + x`.
 */
export function decideTemplateDoors(
  random: Random,
  placements: readonly TemplatePlacement[],
  transforms: readonly Transform[],
  doorChance: number,
  width: number,
): Map<number, boolean> {
  const doors = new Map<number, boolean>();
  for (const placement of placements) {
    placement.cells.forEach((row, dy) => {
      row.forEach((cell, dx) => {
        if (cell !== TemplateCell.Exit && cell !== TemplateCell.Door) {
          return;
        }
        const point = { x: placement.x + dx, y: placement.y + dy };
        const decided = doors.get(point.y * width + point.x);
        if (decided !== undefined) {
          // a doorway that two rooms share has a door if either asks for one
          doors.set(
            point.y * width + point.x,
            decided || cell === TemplateCell.Door,
          );
          return;
        }
        const images = transforms.map((transform) => {
          const image = transform.point(point);
          return doors.get(image.y * width + image.x);
        });
        doors.set(
          point.y * width + point.x,
          cell === TemplateCell.Door ||
            (images.find((door) => door !== undefined) ??
              doorChance > random()),
        );
      });
    });
  }
  return doors;
}
