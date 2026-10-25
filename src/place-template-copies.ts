import type { Area } from './area';
import { checkTemplateSpot } from './check-template-spot';
import type { PlacementArea } from './placement-area';
import { placeTemplate } from './place-template';
import type { Random } from './random';
import { randomInt } from './random-int';
import type { RoomTemplate } from './room-template';
import type { TemplatePlacement } from './template-placement';
import { TemplatePlacementError } from './template-placement-error';
import { validateTemplate } from './validate-template';

/**
 * Places every copy of a template: `count` of them, 1 by default. Each copy
 * takes a random one of the positions not used yet; once those run out, copies
 * go into a random one of the `areas`, or anywhere if there are none. `images` gives the mirror images that each copy brings
 * along; a copy is only placed where they fit too. Returns the new placements,
 * copies and images alike, `obstacles` excluded.
 * Throws a `RangeError` for an invalid template and a `TemplatePlacementError`
 * for one that does not fit.
 */
export function placeTemplateCopies(
  random: Random,
  template: RoomTemplate,
  index: number,
  area: PlacementArea,
  obstacles: readonly TemplatePlacement[],
  images: (placement: TemplatePlacement) => TemplatePlacement[] = () => [],
): TemplatePlacement[] {
  validateTemplate(template, index);
  const count = template.count
    ? randomInt(random, template.count.min, template.count.max)
    : 1;
  const positions = [...(template.positions ?? [])];
  const placed: TemplatePlacement[] = [];
  for (let copy = 0; copy < count; copy++) {
    const position = positions.length
      ? positions.splice(randomInt(random, 0, positions.length - 1), 1)[0]
      : undefined;
    const taken = [...obstacles, ...placed];
    const fits = (candidate: TemplatePlacement): boolean =>
      twinsOf(candidate, taken) !== undefined;
    const original =
      position === undefined && template.areas?.length
        ? placeInAreas(taken, template.areas, fits)
        : placeTemplate(random, template, index, area, taken, position, fits);
    placed.push(original, ...(twinsOf(original, taken) ?? []));
  }
  return placed;

  /** Places a copy in the first of the areas, taken in random order, that has room for it. */
  function placeInAreas(
    taken: readonly TemplatePlacement[],
    areas: readonly Area[],
    fits: (candidate: TemplatePlacement) => boolean,
  ): TemplatePlacement {
    const order = areas.map((region) => ({ region, key: random() }));
    order.sort((a, b) => a.key - b.key);
    let last = '';
    for (const { region } of order) {
      try {
        return placeTemplate(
          random,
          template,
          index,
          area,
          taken,
          undefined,
          fits,
          region,
        );
      } catch (error) {
        if (!(error instanceof TemplatePlacementError)) {
          throw error;
        }
        last = error.reason;
      }
    }
    throw new TemplatePlacementError(
      index,
      template.name,
      `none of its ${String(areas.length)} areas has room for it, the last one because it ${last}`,
    );
  }

  /** The distinct images of a placement that fit beside it, or `undefined` if one does not. */
  function twinsOf(
    placement: TemplatePlacement,
    taken: readonly TemplatePlacement[],
  ): TemplatePlacement[] | undefined {
    const twins: TemplatePlacement[] = [];
    for (const image of images(placement)) {
      if ([placement, ...twins].some((other) => isSame(image, other))) {
        continue;
      }
      if (
        image.x < 0 ||
        image.y < 0 ||
        image.x + image.width > area.width ||
        image.y + image.height > area.height ||
        checkTemplateSpot(image, area, [...taken, placement, ...twins])
      ) {
        return undefined;
      }
      twins.push(image);
    }
    return twins;
  }
}

function isSame(a: TemplatePlacement, b: TemplatePlacement): boolean {
  return (
    a.x === b.x &&
    a.y === b.y &&
    a.width === b.width &&
    a.height === b.height &&
    a.cells.every((row, y) => row.every((cell, x) => cell === b.cells[y]?.[x]))
  );
}
