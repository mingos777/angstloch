import { randomInt } from '../core/random-int';
import type { Random } from '../core/random';
import { resolveRandom } from '../core/resolve-random';
import type { NoiseFunction } from './noise-function';

const SKEW = 0.5 * (Math.sqrt(3) - 1);
const UNSKEW = (3 - Math.sqrt(3)) / 6;

/** Eight unit gradients, 45° apart. */
const GRADIENTS: readonly (readonly [number, number])[] = Array.from(
  { length: 8 },
  (_, i) => [Math.cos((i * Math.PI) / 4), Math.sin((i * Math.PI) / 4)] as const,
);

/** Stretches the sum of the corner contributions to fill the range from -1 to 1. */
const SCALE = 99;

/**
 * Creates 2D simplex noise. The gradients at the lattice points are picked
 * by a permutation table that is shuffled with `random`, so the same random
 * source always gives the same noise, and different sources give different
 * landscapes. `random` is only used here, never when the noise is sampled.
 */
export function createSimplexNoise(random?: Random): NoiseFunction {
  const source = resolveRandom(random);
  const order = Array.from({ length: 256 }, (_, i) => i);
  for (let i = order.length - 1; i > 0; --i) {
    const j = randomInt(source, 0, i);
    [order[i], order[j]] = [order[j] as number, order[i] as number];
  }
  const permutation = new Uint8Array(512);
  for (let i = 0; i < 512; ++i) {
    permutation[i] = order[i % 256] as number;
  }

  const corner = (cellX: number, cellY: number, x: number, y: number) => {
    const falloff = 0.5 - x * x - y * y;
    if (falloff <= 0) {
      return 0;
    }
    const hash = permutation[
      (cellX & 255) + (permutation[cellY & 255] as number)
    ] as number;
    const [gx, gy] = GRADIENTS[hash % GRADIENTS.length] as readonly [
      number,
      number,
    ];
    return falloff ** 4 * (gx * x + gy * y);
  };

  return (x, y) => {
    const skew = (x + y) * SKEW;
    const i = Math.floor(x + skew);
    const j = Math.floor(y + skew);
    const unskew = (i + j) * UNSKEW;
    const x0 = x - (i - unskew);
    const y0 = y - (j - unskew);
    // the second corner is across the longer side of the cell's triangle
    const stepX = x0 > y0 ? 1 : 0;
    const stepY = 1 - stepX;
    const sum =
      corner(i, j, x0, y0) +
      corner(i + stepX, j + stepY, x0 - stepX + UNSKEW, y0 - stepY + UNSKEW) +
      corner(i + 1, j + 1, x0 - 1 + 2 * UNSKEW, y0 - 1 + 2 * UNSKEW);
    return Math.max(-1, Math.min(1, SCALE * sum));
  };
}
