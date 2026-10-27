import { TemplateCell } from '../rooms/templates/template-cell';
import type { ForestFootprint } from './forest-footprint';

/** Whether a tile is a cell of the footprint that is not `Unused`, so that the template forces its tile there. */
export function isTemplateCell(
  { placed, cells }: ForestFootprint,
  x: number,
  y: number,
): boolean {
  const cell = cells[y - placed.y]?.[x - placed.x];
  return cell !== undefined && cell !== TemplateCell.Unused;
}
