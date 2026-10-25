import { createTemplateVariants } from './create-template-variants';
import type { RoomTemplate } from './room-template';
import { templateVariantFitsLattice } from './template-variant-fits-lattice';

/**
 * Throws a `RangeError` naming the template unless its areas, if it has any,
 * lie within a map of the given size, and at least one allowed variant fits
 * in at least one of them.
 */
export function validateTemplateAreas(
  template: RoomTemplate,
  index: number,
  width: number,
  height: number,
  lattice: boolean,
): void {
  const areas = template.areas ?? [];
  if (areas.length === 0) {
    return;
  }
  const label =
    template.name === undefined
      ? `Template #${String(index)}`
      : `Template "${template.name}" (#${String(index)})`;
  areas.forEach((area, i) => {
    if (area.x + area.width > width || area.y + area.height > height) {
      throw new RangeError(
        `${label}: areas[${String(i)}] lies outside the ${String(width)}x${String(height)} map`,
      );
    }
  });
  const variants = createTemplateVariants(template).filter(
    (variant) => !lattice || templateVariantFitsLattice(variant),
  );
  const fits = areas.some((area) =>
    variants.some(
      (variant) => variant.width <= area.width && variant.height <= area.height,
    ),
  );
  if (!fits) {
    throw new RangeError(`${label}: no variant fits in any of its areas`);
  }
}
