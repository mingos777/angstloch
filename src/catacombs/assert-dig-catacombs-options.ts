import { assertFraction } from '../core/assert-fraction';
import { assertLayoutSymmetry } from '../core/assert-layout-symmetry';
import { assertRange } from '../core/assert-range';
import { assertWeight } from '../core/assert-weight';
import { validateTemplate } from '../rooms/templates/validate-template';
import type { DigCatacombsOptions } from './dig-catacombs-options';

/** Throws a `RangeError` unless the options of `digCatacombs` are valid, templates included. The `area` and the templates' areas are checked against the map later (see `assertCatacombArea`). */
export function assertDigCatacombsOptions(options: DigCatacombsOptions): void {
  for (const [name, range, min] of [
    ['mainGalleries', options.mainGalleries, 0],
    ['mainWidth', options.mainWidth, 1],
    ['sideWidth', options.sideWidth, 1],
    ['spacing', options.spacing, 1],
    ['nicheDepth', options.nicheDepth, 1],
    ['nicheSpacing', options.nicheSpacing, 1],
    ['nicheSides', options.nicheSides, 1],
    ['chamberSize.width', options.chamberSize?.width, 1],
    ['chamberSize.depth', options.chamberSize?.depth, 1],
    ['chamberSpacing', options.chamberSpacing, 1],
    ['chamberSides', options.chamberSides, 1],
  ] as const) {
    if (range) {
      assertRange(name, range, min);
    }
  }
  for (const [name, value] of [
    ['loopChance', options.loopChance],
    ['deadEndChance', options.deadEndChance],
    ['chamberNicheChance', options.chamberNicheChance],
    ['deadEndChamberChance', options.deadEndChamberChance],
    ['doorChance', options.doorChance],
    ['symmetryChance', options.symmetryChance],
  ] as const) {
    if (value !== undefined) {
      assertFraction(name, value);
    }
  }
  for (const [name, range] of [
    ['nicheSides', options.nicheSides],
    ['chamberSides', options.chamberSides],
  ] as const) {
    if (range && range.max > 2) {
      throw new RangeError(
        `${name}.max must be at most 2, the sides of a gallery, got ${String(range.max)}`,
      );
    }
  }
  if (options.segments) {
    const { niches = 0, chambers = 0, bare = 0 } = options.segments;
    assertWeight('segments.niches', niches);
    assertWeight('segments.chambers', chambers);
    assertWeight('segments.bare', bare);
    if (niches + chambers + bare <= 0) {
      throw new RangeError('segments needs a weight above 0');
    }
  }
  if (options.symmetry !== undefined) {
    assertLayoutSymmetry('symmetry', options.symmetry);
  }
  options.templates?.forEach((template, index) => {
    validateTemplate(template, index);
  });
}
