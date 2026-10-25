import { assertFraction } from '../core/assert-fraction';
import { assertWholeNumber } from '../core/assert-whole-number';
import type { FractalNoiseOptions } from './fractal-noise-options';
import type { NoiseFunction } from './noise-function';

/**
 * Builds noise with fine detail on top of broad shapes by adding up layers of
 * `noise`, each finer and weaker than the one before. The result is scaled to
 * stay within -1 to 1, like `noise` itself.
 */
export function createFractalNoise(
  noise: NoiseFunction,
  options: FractalNoiseOptions = {},
): NoiseFunction {
  const { octaves = 3, persistence = 0.5, lacunarity = 2 } = options;
  assertWholeNumber('octaves', octaves, 1);
  assertFraction('persistence', persistence);
  if (!(lacunarity > 0 && Number.isFinite(lacunarity))) {
    throw new RangeError(
      `lacunarity must be a positive number, got ${String(lacunarity)}`,
    );
  }

  const layers = Array.from({ length: octaves }, (_, i) => ({
    frequency: lacunarity ** i,
    weight: persistence ** i,
  }));
  const total = layers.reduce((sum, { weight }) => sum + weight, 0);

  return (x, y) =>
    layers.reduce(
      (sum, { frequency, weight }) =>
        sum + weight * noise(x * frequency, y * frequency),
      0,
    ) / total;
}
