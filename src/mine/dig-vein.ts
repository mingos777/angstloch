import type { Grid } from '../core/grid';
import type { Point } from '../core/point';
import type { Random } from '../core/random';
import { randomInt } from '../core/random-int';
import type { Range } from '../core/range';
import type { NoiseFunction } from '../noise/noise-function';
import { joinTiles } from '../roads/join-tiles';
import { carvePassageTiles } from './carve-passage-tiles';
import type { MinePassage } from './mine-passage';
import { tracePassage } from './trace-passage';
import type { VeinLink } from './vein-link';

/** The rings of the map that stay wall, so that the mine is closed in by rock. */
export const MARGIN = 1;
/** The distance between lanes of the noise, as for roads, so that passages bend differently. */
export const LANE_SPACING = 7.31;

/** How veins look. */
export interface VeinStyle {
  width: Range;
  windiness: number;
}

/** Moves the tiles that stray onto the outer rings back in, so that a vein that winds off the map is not cut in two. */
export function keepInside(grid: Grid, tiles: readonly Point[]): Point[] {
  return joinTiles(
    tiles.map(({ x, y }) => ({
      x: Math.min(Math.max(x, MARGIN), grid.width - 1 - MARGIN),
      y: Math.min(Math.max(y, MARGIN), grid.height - 1 - MARGIN),
    })),
  );
}

/**
 * Digs a winding vein between two junctions into the grid. Returns the vein
 * and how many tiles of floor it made, or nothing when a junction is missing.
 * `lane` picks its bends.
 */
export function digVein(
  grid: Grid,
  random: Random,
  noise: NoiseFunction,
  junctions: readonly Point[],
  link: VeinLink,
  style: VeinStyle,
  lane: number,
): { passage: MinePassage; carved: number } | undefined {
  const from = junctions[link.from];
  const to = junctions[link.to];
  if (!from || !to) {
    return undefined;
  }
  const width = randomInt(random, style.width.min, style.width.max);
  const tiles = keepInside(
    grid,
    tracePassage(grid.width, grid.height, noise, {
      from,
      to,
      width,
      windiness: style.windiness,
      lane,
    }),
  );
  const carved = carvePassageTiles(grid, tiles, width, MARGIN);
  return { passage: { kind: 'vein', tiles, width }, carved };
}
