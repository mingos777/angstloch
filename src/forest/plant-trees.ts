import { assertFraction } from '../core/assert-fraction';
import { assertTile } from '../core/assert-tile';
import type { Random } from '../core/random';
import { Tile } from '../core/tile';
import { createFractalNoise } from '../noise/create-fractal-noise';
import { createSimplexNoise } from '../noise/create-simplex-noise';
import type { NoiseFunction } from '../noise/noise-function';
import { transformNoise } from '../noise/transform-noise';
import type { MapStep } from '../pipeline/map-step';
import { step } from '../pipeline/step';
import type { PlantTreesOptions } from './plant-trees-options';

/**
 * A step that plants ground cover: noise decides how thick it is, and every
 * tile that still holds the base tile gets the planted tile with that chance.
 * Planted tiles are marked prunable, so that later steps can clear a verge
 * around what they lay. It adds no extras. Run it first, since a step that
 * runs before it gets no verge. Throws a `RangeError` at once for a bad option.
 */
export function plantTrees(options: PlantTreesOptions = {}): MapStep {
  const {
    scaleX = 40,
    scaleY = 40,
    rotation = 0,
    octaves = 1,
    persistence = 0.2,
    lacunarity = 1,
    density = { min: 0, max: 0.25 },
    tile = Tile.Tree,
  } = options;
  assertFraction('density.min', density.min);
  assertFraction('density.max', density.max);
  if (density.min > density.max) {
    throw new RangeError(
      `density.min (${String(density.min)}) must not exceed density.max (${String(density.max)})`,
    );
  }
  assertTile('tile', tile);

  const buildNoise = (random: Random): NoiseFunction =>
    transformNoise(
      options.noise ??
        createFractalNoise(createSimplexNoise(random), {
          octaves,
          persistence,
          lacunarity,
        }),
      { scaleX, scaleY, rotation },
    );
  // build it once to throw for a bad scale, rotation or fractal option now
  buildNoise(() => 0);

  return step('plantTrees', {}, ({ grid, base, prunable }, { random }) => {
    const noise = buildNoise(random);
    for (let y = 0; y < grid.height; ++y) {
      for (let x = 0; x < grid.width; ++x) {
        if (grid.get(x, y) !== base) {
          continue;
        }
        // the noise from -1 to 1 becomes a position between the two densities
        const level =
          (Math.max(-1, Math.min(1, noise(x + 0.5, y + 0.5))) + 1) / 2;
        const chance = density.min + (density.max - density.min) * level;
        if (random() < chance) {
          grid.set(x, y, tile);
          prunable[y * grid.width + x] = 1;
        }
      }
    }
    return {};
  });
}
