import type { Transform } from './create-transforms';
import { createTemplateTwin } from './create-template-twin';
import type { PlacementArea } from '../placement-area';
import { placeTemplateCopies } from './place-template-copies';
import type { Random } from '../../core/random';
import type { RoomTemplate } from './room-template';
import type { TemplatePlacement } from './template-placement';

/** A placed copy of a template, and the template's index. */
export interface PlacedTemplate {
  placement: TemplatePlacement;
  template: number;
}

/**
 * Places every copy of every template, in the order of the list. Each copy
 * brings its mirror images along, one per transform, when there are any, and
 * keeps clear of the `obstacles`, which are not returned.
 * Throws a `TemplatePlacementError` for a template that does not fit.
 */
export function placeRoomTemplates(
  random: Random,
  templates: readonly RoomTemplate[],
  area: PlacementArea,
  transforms: readonly Transform[],
  obstacles: readonly TemplatePlacement[] = [],
): PlacedTemplate[] {
  const placed: PlacedTemplate[] = [];
  templates.forEach((template, index) => {
    const copies = placeTemplateCopies(
      random,
      template,
      index,
      area,
      [...obstacles, ...placed.map(({ placement }) => placement)],
      (placement) =>
        transforms.map((transform) => createTemplateTwin(placement, transform)),
    );
    for (const placement of copies) {
      placed.push({ placement, template: index });
    }
  });
  return placed;
}
