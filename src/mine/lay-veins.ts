import type { Grid } from '../core/grid';
import type { Point } from '../core/point';
import type { Random } from '../core/random';
import type { Range } from '../core/range';
import type { NoiseFunction } from '../noise/noise-function';
import { digVein, LANE_SPACING, MARGIN } from './dig-vein';
import type { MinePassage } from './mine-passage';
import { planVeinLinks } from './plan-vein-links';
import type { VeinLink } from './vein-link';

/** The settings of the veins layout, with every default filled in. */
export interface VeinSettings {
  density: number;
  veinWidth: Range;
  veinWindiness: number;
  veinSpacing: number;
  /** The lane of the noise for the first vein, and the lanes of the veins after it. Defaults to 0.5. */
  lane?: number;
  /** Tiles that are never dug, a byte for each tile of the grid, row by row: anything but 0 protects it. Defaults to none. */
  protect?: Uint8Array;
}

/**
 * Scatters the junctions: the interior of the map is cut into cells about
 * `spacing` tiles across, and every cell gets one junction at a random spot
 * well inside it. That spreads them out evenly without lining them up.
 */
function scatterJunctions(
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

/**
 * Digs a web of veins into the grid and returns them. Junctions are spread
 * over the map, and the shortest set of veins that joins them all is dug,
 * which makes the mine one piece. Then extra veins between neighboring
 * junctions are dug, shortest first, until the density is reached or there are
 * none left, which turns the tree into a web with loops.
 */
export function layVeins(
  grid: Grid,
  random: Random,
  noise: NoiseFunction,
  settings: VeinSettings,
): MinePassage[] {
  const { density, veinWidth, veinWindiness, veinSpacing } = settings;
  const junctions = scatterJunctions(grid, random, veinSpacing);
  const { tree, extras } = planVeinLinks(junctions, random);
  const passages: MinePassage[] = [];
  const target = density * grid.width * grid.height;
  let floor = 0;

  const dig = (link: VeinLink): void => {
    const vein = digVein(
      grid,
      random,
      noise,
      junctions,
      link,
      { width: veinWidth, windiness: veinWindiness, protect: settings.protect },
      (settings.lane ?? 0.5) + passages.length * LANE_SPACING,
    );
    if (vein) {
      floor += vein.carved;
      passages.push(vein.passage);
    }
  };

  tree.forEach(dig);
  for (const extra of extras) {
    if (floor >= target) {
      break;
    }
    dig(extra);
  }
  return passages;
}
