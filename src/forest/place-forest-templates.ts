import type { Clearing } from './clearing';
import { randomInt } from '../core/random-int';
import type { Random } from '../core/random';
import { shuffle } from '../core/shuffle';
import { createTemplateVariants } from '../rooms/templates/create-template-variants';
import type { RoomTemplate } from '../rooms/templates/room-template';
import { TemplateCell } from '../rooms/templates/template-cell';
import { TemplatePlacementError } from '../rooms/templates/template-placement-error';
import type { TemplateVariant } from '../rooms/templates/template-variant';
import type { ForestFootprint } from './forest-footprint';

/** How many random spots are tried for a template that goes anywhere. */
const ATTEMPTS = 200;

/**
 * Places the copies of every template in a forest, in the order of the list.
 * A template with a `clearing` is centered on a free clearing of `clearings`,
 * or goes to a random spot with a clearing of its own when none has room, and
 * any other template goes to a random spot. A copy is only placed where none of its
 * cells, other than `Unused` ones, lies on a tile that `blocked` marks (roads
 * and water) or on a cell of another template. Each copy is placed with the
 * `chance` of its template, and a clearing holds one template at most.
 * Throws a `TemplatePlacementError` for a copy that finds no place.
 */
export function placeForestTemplates(
  random: Random,
  templates: readonly RoomTemplate[],
  clearings: readonly Clearing[],
  width: number,
  height: number,
  blocked: Uint8Array,
): ForestFootprint[] {
  const footprints: ForestFootprint[] = [];
  const taken = new Uint8Array(width * height);
  const used = new Set<number>();

  /** Whether the variant, with its box's corner at a spot, keeps clear of every blocked tile and every other template. */
  const fits = (variant: TemplateVariant, x: number, y: number): boolean => {
    if (
      x < 0 ||
      y < 0 ||
      x + variant.width > width ||
      y + variant.height > height
    ) {
      return false;
    }
    return variant.cells.every((row, dy) =>
      row.every((cell, dx) => {
        const at = (y + dy) * width + x + dx;
        return cell === TemplateCell.Unused || (!blocked[at] && !taken[at]);
      }),
    );
  };

  templates.forEach((template, index) => {
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
    const count = template.count
      ? randomInt(random, template.count.min, template.count.max)
      : 1;
    const chance = template.chance ?? 1;
    for (let copy = 0; copy < count; ++copy) {
      if (chance < 1 && random() >= chance) {
        continue;
      }
      const variants = shuffle(random, createTemplateVariants(template));
      // a template that needs a clearing makes its own when none is free
      const found = template.clearing
        ? (onClearing(variants) ?? anywhere(variants, true))
        : anywhere(variants, false);
      if (!found) {
        throw new TemplatePlacementError(index, template.name, 'no free spot');
      }
      const { variant, x, y, clearing, own } = found;
      variant.cells.forEach((row, dy) => {
        row.forEach((cell, dx) => {
          if (cell !== TemplateCell.Unused) {
            taken[(y + dy) * width + x + dx] = 1;
          }
        });
      });
      footprints.push({
        placed: {
          template: index,
          x,
          y,
          width: variant.width,
          height: variant.height,
          rotation: variant.rotation,
          mirrored: variant.mirrored,
          ownClearing: own,
          ...(clearing === undefined ? {} : { clearing }),
        },
        cells: variant.cells,
        margin: own ? (template.margin ?? 0) : 0,
      });
    }
  });
  return footprints;

  /** The first free clearing, in random order, that a variant fits on with its box centered on the clearing. */
  function onClearing(variants: readonly TemplateVariant[]) {
    const order = shuffle(
      random,
      clearings.map((_, i) => i).filter((i) => !used.has(i)),
    );
    for (const clearing of order) {
      const { x: cx, y: cy } = clearings[clearing] as Clearing;
      for (const variant of variants) {
        const x = cx - Math.floor(variant.width / 2);
        const y = cy - Math.floor(variant.height / 2);
        if (fits(variant, x, y)) {
          used.add(clearing);
          return { variant, x, y, clearing, own: false };
        }
      }
    }
    return undefined;
  }

  /** A random spot that a random variant fits on, which is the spot of the clearing the template makes for itself when `own` says so. */
  function anywhere(variants: readonly TemplateVariant[], own: boolean) {
    for (let attempt = 0; attempt < ATTEMPTS; ++attempt) {
      const variant = variants[attempt % variants.length] as TemplateVariant;
      if (variant.width > width || variant.height > height) {
        continue;
      }
      const x = randomInt(random, 0, width - variant.width);
      const y = randomInt(random, 0, height - variant.height);
      if (fits(variant, x, y)) {
        return { variant, x, y, clearing: undefined, own };
      }
    }
    return undefined;
  }
}
