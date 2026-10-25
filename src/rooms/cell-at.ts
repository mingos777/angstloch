import { TemplateCell } from './templates/template-cell';
import type { TemplatePlacement } from './templates/template-placement';

/** Returns the cell of a placement at a map position, `Unused` outside its bounding box. */
export function cellAt(
  placement: TemplatePlacement,
  x: number,
  y: number,
): TemplateCell {
  return (
    placement.cells[y - placement.y]?.[x - placement.x] ?? TemplateCell.Unused
  );
}
