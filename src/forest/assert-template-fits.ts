import { createTemplateVariants } from '../rooms/templates/create-template-variants';
import type { RoomTemplate } from '../rooms/templates/room-template';
import { TemplatePlacementError } from '../rooms/templates/template-placement-error';

/**
 * Throws a permanent `TemplatePlacementError` unless at least one variant of
 * the template fits in the map, since no other map could fix that.
 */
export function assertTemplateFits(
  template: RoomTemplate,
  index: number,
  width: number,
  height: number,
): void {
  if (
    createTemplateVariants(template).every(
      (variant) => variant.width > width || variant.height > height,
    )
  ) {
    throw new TemplatePlacementError(
      index,
      template.name,
      `is bigger than the ${String(width)}x${String(height)} map`,
      true,
    );
  }
}
