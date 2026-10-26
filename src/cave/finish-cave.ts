import { carveCaveExit } from './carve-cave-exit';
import type { CaveResult } from './cave-result';
import { connectCaves } from './connect-caves';
import { createTransforms } from '../rooms/templates/create-transforms';
import { describeCaveRegion } from './describe-cave-region';
import { findCaveRegions } from './find-cave-regions';
import type { Grid } from '../core/grid';
import type { Point } from '../core/point';
import { randomInt } from '../core/random-int';
import type { Random } from '../core/random';
import type { ResolvedCaveConnectionOptions } from './resolve-cave-connection-options';
import { Tile } from '../core/tile';

/** How many times in a row an exit may fail, when it is left out for lack of room or for being crowded, before the generator stops trying. */
const EXIT_ATTEMPTS = 10;

/**
 * Turns the caverns of a freshly made grid into a finished cave: fills in
 * small or surplus caverns, joins the rest, adds exits and describes the
 * regions. It changes `grid` in place.
 */
export function finishCave(
  grid: Grid,
  random: Random,
  options: ResolvedCaveConnectionOptions,
): CaveResult {
  const {
    borderWalls,
    minRegionSize,
    connect,
    tunnelStyle,
    tunnelWidth,
    tunnelWindiness,
    tunnelLoops,
    tunnelSymmetryChance,
    layoutSymmetry,
    layoutSymmetryChance,
    minExits,
    maxExits,
  } = options;

  findCaveRegions(grid).forEach((tiles, index) => {
    if (tiles.length < minRegionSize || (connect === 'largest' && index > 0)) {
      for (const { x, y } of tiles) {
        grid.set(x, y, Tile.Wall);
      }
    }
  });
  if (connect === 'tunnel') {
    connectCaves(grid, random, {
      tunnel: {
        style: tunnelStyle,
        width: tunnelWidth,
        windiness: tunnelWindiness,
        borderWalls,
      },
      loops: tunnelLoops,
      symmetry: layoutSymmetry,
      symmetryChance: tunnelSymmetryChance,
    });
  }

  const exits: Point[] = [];
  const wanted = randomInt(random, minExits, maxExits);
  const images = createTransforms(
    layoutSymmetry,
    grid.width,
    grid.height,
    false,
  );
  for (let misses = 0; exits.length < wanted && misses < EXIT_ATTEMPTS;) {
    const made = carveCaveExit(grid, random, exits, {
      images,
      chance: layoutSymmetryChance,
      room: wanted - exits.length,
    });
    if (made.length === 0) {
      ++misses;
    }
    exits.push(...made);
  }

  return {
    grid,
    regions: findCaveRegions(grid).map(describeCaveRegion),
    exits,
  };
}
