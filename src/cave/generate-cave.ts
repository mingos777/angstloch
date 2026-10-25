import { assertDimensions } from '../core/assert-dimensions';
import { assertFraction } from '../core/assert-fraction';
import { assertWholeNumber } from '../core/assert-whole-number';
import type { CaveNeighborhood, CaveOptions } from './cave-options';
import type { CaveResult } from './cave-result';
import { carveCaveExit } from './carve-cave-exit';
import { connectCaves } from './connect-caves';
import { describeCaveRegion } from './describe-cave-region';
import { findCaveRegions } from './find-cave-regions';
import { Grid } from '../core/grid';
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
  assertWholeNumber('minExits', minExits, 0);
  const maxExits = Math.max(minExits, options.maxExits ?? minExits);
  assertWholeNumber('maxExits', maxExits, 0);
  const random = resolveRandom(options.random);

  let grid = new Grid(width, height);
  for (let y = 0; y < height; ++y) {
    for (let x = 0; x < width; ++x) {
      const isBorder =
        x === 0 || y === 0 || x === width - 1 || y === height - 1;
      const isWall = (borderWalls && isBorder) || random() < fillChance;
      grid.set(x, y, isWall ? Tile.Wall : Tile.Floor);
    }
  }
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
      style: tunnelStyle,
      width: tunnelWidth,
      windiness: tunnelWindiness,
      borderWalls,
    });
  }

  const exits: Point[] = [];
  for (let i = randomInt(random, minExits, maxExits); i > 0; --i) {
    const exit = carveCaveExit(grid, random, exits);
    if (exit) {
      exits.push(exit);
    }
  }

  return {
    grid,
    regions: findCaveRegions(grid).map(describeCaveRegion),
    exits,
  };
}
