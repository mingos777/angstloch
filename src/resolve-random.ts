import type { Random } from './random';

/** Returns the injected random source, falling back to `Math.random`. */
export function resolveRandom(random?: Random): Random {
  return random ?? Math.random;
}
