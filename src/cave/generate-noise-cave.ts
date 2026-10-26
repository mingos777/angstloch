import { assertDimensions } from '../core/assert-dimensions';
import { assertFraction } from '../core/assert-fraction';
import { assertWholeNumber } from '../core/assert-whole-number';
import type { CaveResult } from './cave-result';
import { CAVE_DEFAULT_LIMITS } from './cave-default-limits';
import { createFractalNoise } from '../noise/create-fractal-noise';
import { createNoiseCaveGrid } from './create-noise-cave-grid';
import { createSimplexNoise } from '../noise/create-simplex-noise';
import { finishCave } from './finish-cave';
import type { NoiseCaveOptions } from './noise-cave-options';
import { resolveCaveConnectionOptions } from './resolve-cave-connection-options';
import { resolveRandom } from '../core/resolve-random';
import { smoothCave } from './smooth-cave';
import { transformNoise } from '../noise/transform-noise';

/**
 * Generates a cave by thresholding noise: the tiles with the lowest noise
 * become walls, and the rest become floor, which gives caverns that follow
 * the shapes of the noise. With `shape: 'veins'`, the floor follows the
 * midpoint of the noise instead, and makes winding corridors.
 */
export function generateNoiseCave(options: NoiseCaveOptions): CaveResult {
  const {
    width,
    height,
    shape = 'blobs',
    fill = 0.45,
    cornerBias = 4,
    scaleX = 12,
    scaleY = 12,
    rotation = 0,
    octaves = 3,
    persistence = 0.5,
    lacunarity = 2,
    iterations = 0,
  } = options;

  assertDimensions(width, height);
  assertFraction('fill', fill);
  assertWholeNumber('cornerBias', cornerBias, 0);
  assertWholeNumber('iterations', iterations, 0);
  const connection = resolveCaveConnectionOptions(options);
  const random = resolveRandom(options.random);

  const noise = transformNoise(
    options.noise ??
      createFractalNoise(createSimplexNoise(random), {
        octaves,
        persistence,
        lacunarity,
      }),
    { scaleX, scaleY, rotation },
  );

  let grid = createNoiseCaveGrid(random, {
    width,
    height,
    noise,
    shape,
    fill,
    cornerBias,
    borderWalls: connection.borderWalls,
    symmetry: connection.layoutSymmetry,
    symmetryChance: connection.layoutSymmetryChance,
  });
  const rules = {
    ...CAVE_DEFAULT_LIMITS.moore,
    neighborhood: 'moore',
    borderWalls: connection.borderWalls,
  } as const;
  for (let i = 0; i < iterations; ++i) {
    grid = smoothCave(grid, rules);
  }

  return finishCave(grid, random, connection);
}
