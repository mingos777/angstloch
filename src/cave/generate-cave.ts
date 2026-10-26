import { assertDimensions } from '../core/assert-dimensions';
import { assertFraction } from '../core/assert-fraction';
import { assertWholeNumber } from '../core/assert-whole-number';
import { CAVE_DEFAULT_LIMITS } from './cave-default-limits';
import type { CaveOptions } from './cave-options';
import type { CaveResult } from './cave-result';
import { createCaveNoise } from './create-cave-noise';
import { finishCave } from './finish-cave';
import { resolveCaveConnectionOptions } from './resolve-cave-connection-options';
import { resolveRandom } from '../core/resolve-random';
import { smoothCave } from './smooth-cave';

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
  } = options;
  const {
    birthLimit = CAVE_DEFAULT_LIMITS[neighborhood].birthLimit,
    survivalLimit = CAVE_DEFAULT_LIMITS[neighborhood].survivalLimit,
  } = options;

  assertDimensions(width, height);
  assertFraction('fillChance', fillChance);
  assertWholeNumber('iterations', iterations, 0);
  assertWholeNumber('birthLimit', birthLimit, 0);
  assertWholeNumber('survivalLimit', survivalLimit, 0);
  const connection = resolveCaveConnectionOptions(options);
  const random = resolveRandom(options.random);

  let grid = createCaveNoise(random, {
    width,
    height,
    fillChance,
    borderWalls: connection.borderWalls,
    symmetry: connection.layoutSymmetry,
    symmetryChance: connection.layoutSymmetryChance,
  });
  const rules = {
    birthLimit,
    survivalLimit,
    neighborhood,
    borderWalls: connection.borderWalls,
  };
  for (let i = 0; i < iterations; ++i) {
    grid = smoothCave(grid, rules);
  }

  return finishCave(grid, random, connection);
}
