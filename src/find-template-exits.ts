import { DIRECTIONS } from './directions';
import { TemplateCell } from './template-cell';
import type { TemplateExit } from './template-exit';

/**
 * Finds the exit candidates of a template: `Exit`, `Door` and `OptionalExit` cells with an
 * orthogonal neighbor that is `Unused` or beyond the edge. Other
 * exits and doors are internal and not listed.
 */
export function findTemplateExits(cells: TemplateCell[][]): TemplateExit[] {
  const exits: TemplateExit[] = [];
  cells.forEach((row, y) => {
    row.forEach((cell, x) => {
      if (
        cell !== TemplateCell.Exit &&
        cell !== TemplateCell.Door &&
        cell !== TemplateCell.OptionalExit
      ) {
        return;
      }
      const directions: number[] = [];
      DIRECTIONS.forEach((step, direction) => {
        const neighbor = cells[y + step.y]?.[x + step.x];
        if (neighbor === undefined || neighbor === TemplateCell.Unused) {
          directions.push(direction);
        }
      });
      if (directions.length > 0) {
        exits.push({ x, y, kind: cell, directions });
      }
    });
  });
  return exits;
}
