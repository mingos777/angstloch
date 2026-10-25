import type { Random } from './random';

/** Options shared by every generator. */
export interface BaseOptions {
  /** Map width in tiles. */
  width: number;
  /** Map height in tiles. */
  height: number;
  /** Source of randomness. Defaults to `Math.random`. */
  random?: Random;
}
