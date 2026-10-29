import type { Grid } from '../core/grid';
import type { Point } from '../core/point';
import type { Random } from '../core/random';
import { MARGIN } from './dig-vein';

/**
 * Scatters the junctions of a web: the interior of the map is cut into cells
 * about `spacing` tiles across, and every cell gets one junction at a random
 * spot well inside it. That spreads them out evenly without lining them up.
 */
export function scatterJunctions(
  grid: Grid,
  random: Random,
  spacing: number,
): Point[] {
  const interiorWidth = grid.width - 2 * MARGIN;
  const interiorHeight = grid.height - 2 * MARGIN;
  if (interiorWidth < 1 || interiorHeight < 1) {
    return [];
  }
  let columns = Math.max(1, Math.round(interiorWidth / spacing));
  let rows = Math.max(1, Math.round(interiorHeight / spacing));
  if (columns * rows < 2) {
    // a web needs at least two junctions, along the longer side
    if (interiorWidth >= interiorHeight) {
      columns = 2;
    } else {
      rows = 2;
    }
  }
  const junctions: Point[] = [];
  const seen = new Set<number>();
  for (let row = 0; row < rows; ++row) {
    for (let column = 0; column < columns; ++column) {
      const x =
        MARGIN +
        Math.min(
          interiorWidth - 1,
          Math.floor(
            ((column + 0.2 + 0.6 * random()) * interiorWidth) / columns,
          ),
        );
      const y =
        MARGIN +
        Math.min(
          interiorHeight - 1,
          Math.floor(((row + 0.2 + 0.6 * random()) * interiorHeight) / rows),
        );
      if (!seen.has(y * grid.width + x)) {
        seen.add(y * grid.width + x);
        junctions.push({ x, y });
      }
    }
  }
  return junctions;
}
