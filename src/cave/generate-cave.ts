import { assertDimensions } from '../core/assert-dimensions';
import { assertFraction } from '../core/assert-fraction';
import { assertLayoutSymmetry } from '../core/assert-layout-symmetry';
import { assertWholeNumber } from '../core/assert-whole-number';
import type { CaveNeighborhood, CaveOptions } from './cave-options';
import type { CaveResult } from './cave-result';
import { carveCaveExit } from './carve-cave-exit';
import { connectCaves } from './connect-caves';
import { createCaveNoise } from './create-cave-noise';
import { createTransforms } from '../rooms/templates/create-transforms';
import { describeCaveRegion } from './describe-cave-region';
import { findCaveRegions } from './find-cave-regions';
import type { Point } from '../core/point';
import { randomInt } from '../core/random-int';
import { resolveRandom } from '../core/resolve-random';
import { smoothCave } from './smooth-cave';
import { Tile } from '../core/tile';

const DEFAULT_LIMITS: Record<
  CaveNeighborhood,
  { birthLimit: number; survivalLimit: number }
> = {
  moore: { birthLimit: 5, survivalLimit: 4 },
  'von-neumann': { birthLimit: 3, survivalLimit: 2 },
};

/** How many times in a row an exit may fail, when it is left out for lack of room or for being crowded, before the generator stops trying. */
const EXIT_ATTEMPTS = 10;

/**
 * Generates a cave with a cellular automaton: the map starts as random noise
 * and is smoothed over a number of passes until walls and floors clump into
 * caverns.
 */
export function generateCave(options: CaveOptions): CaveResult {
  const {
    width,
    height,
    fillChance = 0.45,
    iterations = 4,
    neighborhood = 'moore',
    borderWalls = true,
    minRegionSize = 0,
    connect = 'tunnel',
    tunnelStyle = 'winding',
    tunnelWidth = 1,
    tunnelWindiness = 0.5,
    tunnelLoops = 0,
    tunnelSymmetryChance = 1,
    layoutSymmetry = 'none',
    layoutSymmetryChance = 1,
    minExits = 0,
  } = options;
  const {
    birthLimit = DEFAULT_LIMITS[neighborhood].birthLimit,
    survivalLimit = DEFAULT_LIMITS[neighborhood].survivalLimit,
  } = options;

  assertDimensions(width, height);
  assertFraction('fillChance', fillChance);
  assertWholeNumber('iterations', iterations, 0);
  assertWholeNumber('birthLimit', birthLimit, 0);
  assertWholeNumber('survivalLimit', survivalLimit, 0);
  assertWholeNumber('minRegionSize', minRegionSize, 0);
  assertWholeNumber('tunnelWidth', tunnelWidth, 1);
  assertFraction('tunnelWindiness', tunnelWindiness);
  assertFraction('tunnelLoops', tunnelLoops);
  assertFraction('tunnelSymmetryChance', tunnelSymmetryChance);
  assertLayoutSymmetry('layoutSymmetry', layoutSymmetry);
  assertFraction('layoutSymmetryChance', layoutSymmetryChance);
  assertWholeNumber('minExits', minExits, 0);
  const maxExits = Math.max(minExits, options.maxExits ?? minExits);
  assertWholeNumber('maxExits', maxExits, 0);
  const random = resolveRandom(options.random);

  let grid = createCaveNoise(random, {
    width,
    height,
    fillChance,
    borderWalls,
    symmetry: layoutSymmetry,
    symmetryChance: layoutSymmetryChance,
  });
  const rules = { birthLimit, survivalLimit, neighborhood, borderWalls };
  for (let i = 0; i < iterations; ++i) {
    grid = smoothCave(grid, rules);
  }

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
  const images = createTransforms(layoutSymmetry, width, height, false);
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
