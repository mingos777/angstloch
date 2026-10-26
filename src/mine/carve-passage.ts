import type { Grid } from '../core/grid';
import type { NoiseFunction } from '../noise/noise-function';
import { carvePassageTiles } from './carve-passage-tiles';
import type { Passage } from './passage';
import type { PassageSpec } from './passage-spec';
import { tracePassage } from './trace-passage';

/**
 * Carves a winding passage of floor into the grid and returns it. It goes
 * either between two tiles, or from one tile in a direction until it has
 * covered its length or left the map. The noise decides the bends. Tiles off
 * the grid are skipped, and anything that is not wall is left as it is, since
 * a passage only ever adds floor. The `margin` outermost rings of the grid are
 * never carved.
 */
export function carvePassage(
  grid: Grid,
  noise: NoiseFunction,
  spec: PassageSpec,
  margin = 0,
): Passage {
  const tiles = tracePassage(grid.width, grid.height, noise, spec);
  carvePassageTiles(grid, tiles, spec.width, margin);
  return { tiles, width: spec.width };
}
