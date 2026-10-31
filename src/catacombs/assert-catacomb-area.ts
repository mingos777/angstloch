import type { AreaSpec } from '../pipeline/area-spec';
import { assertAreaSpec } from '../pipeline/assert-area-spec';
import { assertWallBase } from '../pipeline/assert-wall-base';
import type { MapState } from '../pipeline/map-state';
import { validateTemplateAreas } from '../rooms/templates/validate-template-areas';
import type { CatacombSettings } from './catacomb-settings';
import { sideRoom } from './side-room';

/**
 * Checks what `digCatacombs` needs of the map, for its `validate`: the map
 * starts as wall, the `area` fits the map (see `assertAreaSpec`), and the
 * smallest area holds two side galleries of the narrowest width each way, the
 * narrowest rock between them, the room for niches and chambers (see
 * `sideRoom`) and the ring of wall round them, and the areas of the templates
 * lie in the map (see `validateTemplateAreas`). Throws a `RangeError`.
 */
export function assertCatacombArea(
  state: MapState,
  area: AreaSpec,
  settings: CatacombSettings,
): void {
  const { width, height } = state.grid;
  assertWallBase('digCatacombs', state);
  assertAreaSpec(area, { min: 1, max: 1 }, width, height);
  const needed =
    2 +
    2 * settings.sideWidth.min +
    settings.spacing.min +
    4 * sideRoom(settings);
  const smallest = {
    width: area.width?.min ?? width,
    height: area.height?.min ?? height,
  };
  if (smallest.width < needed || smallest.height < needed) {
    throw new RangeError(
      `digCatacombs needs an area of at least ${String(needed)} by ${String(needed)} tiles for two side galleries each way and the room for their niches and chambers, got ${String(smallest.width)} by ${String(smallest.height)}`,
    );
  }
  settings.templates.forEach((template, index) => {
    validateTemplateAreas(template, index, width, height, false);
  });
}
