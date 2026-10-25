import type { Rotation } from './rotation';
import type { RoomTemplate } from './room-template';
import type { TemplateCell } from './template-cell';
import type { TemplateVariant } from './template-variant';

/**
 * Lists the distinct ways to place a template: every allowed rotation, each
 * also mirrored if the template allows it. `rotations` narrows the template's
 * own `rotate` list down (it defaults to it). Variants that look the same,
 * such as a symmetric room turned by 180 degrees, are listed once, so that
 * picking a variant at random does not favor symmetric rooms.
 */
export function createTemplateVariants(
  template: RoomTemplate,
  rotations: readonly Rotation[] = template.rotate ?? [0],
): TemplateVariant[] {
  const variants: TemplateVariant[] = [];
  const seen = new Set<string>();
  for (const rotation of rotations) {
    for (const mirrored of template.mirror === true ? [false, true] : [false]) {
      const cells = rotate(
        mirrored ? mirror(template.cells) : template.cells,
        rotation,
      );
      const key = cells.map((row) => row.join('')).join('/');
      if (seen.has(key)) {
        continue;
      }
      seen.add(key);
      variants.push({
        cells,
        width: cells[0]?.length ?? 0,
        height: cells.length,
        rotation,
        mirrored,
      });
    }
  }
  return variants;
}

function mirror(cells: TemplateCell[][]): TemplateCell[][] {
  return cells.map((row) => [...row].reverse());
}

function rotate(cells: TemplateCell[][], rotation: Rotation): TemplateCell[][] {
  let result = cells;
  for (let turns = rotation / 90; turns > 0; turns--) {
    result = turnClockwise(result);
  }
  return result;
}

function turnClockwise(cells: TemplateCell[][]): TemplateCell[][] {
  const height = cells.length;
  const width = cells[0]?.length ?? 0;
  return Array.from({ length: width }, (_, y) =>
    Array.from(
      { length: height },
      (_, x) => cells[height - 1 - x]?.[y] as TemplateCell,
    ),
  );
}
