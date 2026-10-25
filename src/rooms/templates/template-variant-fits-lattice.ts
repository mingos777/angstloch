import { DIRECTIONS } from '../../core/directions';
import { TemplateCell } from './template-cell';
import type { TemplateVariant } from './template-variant';
import { findTemplateExits } from './find-template-exits';

/**
 * Whether a variant can sit on the lattice, where its bounding box starts on
 * even coordinates: its dimensions are odd, every `Exit` and `Door` that leads
 * outside faces a tile with odd coordinates, which is where corridors start,
 * and so does at least one exit candidate of any kind.
 */
export function templateVariantFitsLattice(
  variant: Pick<TemplateVariant, 'cells' | 'width' | 'height'>,
): boolean {
  if (variant.width % 2 === 0 || variant.height % 2 === 0) {
    return false;
  }
  let anyUsable = false;
  for (const exit of findTemplateExits(variant.cells)) {
    const usable = exit.directions.some((direction) => {
      const step = DIRECTIONS[direction];
      return (
        step !== undefined &&
        (exit.x + step.x) % 2 !== 0 &&
        (exit.y + step.y) % 2 !== 0
      );
    });
    if (usable) {
      anyUsable = true;
    } else if (exit.kind !== TemplateCell.OptionalExit) {
      return false;
    }
  }
  return anyUsable;
}
