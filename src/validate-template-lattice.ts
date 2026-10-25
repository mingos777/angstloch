import { createTemplateVariants } from './create-template-variants';
import type { RoomTemplate } from './room-template';
import { templateVariantFitsLattice } from './template-variant-fits-lattice';

/**
 * Throws a `RangeError` naming the template unless at least one of its
 * variants fits the lattice, see `templateVariantFitsLattice`.
 */
export function validateTemplateLattice(
  template: RoomTemplate,
  index: number,
): void {
  if (!createTemplateVariants(template).some(templateVariantFitsLattice)) {
    const label =
      template.name === undefined
        ? `Template #${String(index)}`
        : `Template "${template.name}" (#${String(index)})`;
    throw new RangeError(
      `${label}: no variant fits the lattice, which needs odd dimensions and ` +
        'every exit facing a tile with odd coordinates',
    );
  }
}
