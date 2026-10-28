import type { MapStep } from '../pipeline/map-step';
import { stampTile } from '../pipeline/stamp-tile';
import { step } from '../pipeline/step';
import { assertDistanceMetric } from '../roads/assert-distance-metric';
import { pruneVerge } from '../roads/prune-verge';
import { assertForestTemplates } from './assert-forest-templates';
import { assertTemplateFits } from './assert-template-fits';
import type { ForestTemplate } from './forest-template';
import { placeForestTemplates } from './place-forest-templates';
import type { PlaceTemplatesOptions } from './place-templates-options';
import type { PlacedClearing } from './placed-clearing';
import { templateTile } from './template-tile';

/**
 * A step that places templates: ruins, camps, boss arenas. A template with a
 * `clearing` is centered on a free clearing from the `clearings` of the state,
 * or gets a clearing of its own at a random spot, where its box is free of trees
 * and the trees thicken over its `margin`. Any other template goes to a random
 * spot and leaves the trees round it. `Floor` and `Wall` cells are stamped,
 * `Unused` ones leave the map as it is. It adds `templates`.
 *
 * A template goes only where none of its cells, other than `Unused` ones, lies
 * on a tile that something has been stamped on (road, water, another template),
 * so run it after the steps that lay those, and after `plantTrees`. A copy
 * that finds no spot throws a `TemplatePlacementError`, which `pipeline` answers
 * with a new map. Throws a `RangeError` at once for a bad template, and for one
 * bigger than the map, which `pipeline` finds out before the first attempt.
 */
export function placeTemplates(
  options: PlaceTemplatesOptions,
): MapStep<
  Partial<{ clearings: PlacedClearing[] }>,
  { templates: ForestTemplate[] }
> {
  const { templates } = options;
  assertForestTemplates(templates);
  assertDistanceMetric(options.distance ?? 'chebyshev');

  return step<
    Partial<{ clearings: PlacedClearing[] }>,
    { templates: ForestTemplate[] }
  >(
    'placeTemplates',
    {
      adds: ['templates'],
      // no other map could make a template fit that is bigger than this one
      validate: ({ grid }) => {
        templates.forEach((template, index) => {
          assertTemplateFits(template, index, grid.width, grid.height);
        });
      },
    },
    (state, { random }) => {
      const { grid, base, prunable } = state;
      const { width, height } = grid;
      // a tile is free to build on if it is untouched ground or ground cover
      const blocked = Uint8Array.from(prunable, (cover, at) =>
        cover || grid.get(at % width, Math.floor(at / width)) === base ? 0 : 1,
      );
      const footprints = placeForestTemplates(
        random,
        templates,
        state.clearings ?? [],
        width,
        height,
        blocked,
      );
      for (const { placed, cells, margin } of footprints) {
        if (placed.ownClearing) {
          // the box is bare, and the trees thicken over the margin beyond it
          const box = new Uint8Array(width * height);
          for (let y = placed.y; y < placed.y + placed.height; ++y) {
            box.fill(
              1,
              y * width + placed.x,
              y * width + placed.x + placed.width,
            );
          }
          pruneVerge(
            state,
            box,
            { falloff: margin, distance: options.distance },
            random,
          );
        }
        cells.forEach((row, dy) => {
          row.forEach((cell, dx) => {
            const tile = templateTile(cell);
            if (tile !== undefined) {
              stampTile(state, placed.x + dx, placed.y + dy, tile);
            }
          });
        });
      }
      return { templates: footprints.map(({ placed }) => placed) };
    },
  );
}
