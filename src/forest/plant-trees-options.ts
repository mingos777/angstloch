import type { Range } from '../core/range';
import type { Tile } from '../core/tile';
import type { NoiseFunction } from '../noise/noise-function';

export interface PlantTreesOptions {
  /** Size in tiles of a feature of the density noise along the x axis, before rotation. Larger values make broader woods and glades. Defaults to 40. */
  scaleX?: number;
  /** Size in tiles of a feature of the density noise along the y axis, before rotation. Defaults to 40. */
  scaleY?: number;
  /** Clockwise rotation of the density noise in degrees, which makes stretched woods run diagonally. Defaults to 0. */
  rotation?: number;
  /** Number of layers of noise of the built-in noise, each finer than the one before. With the default of 1 there is a single layer, and `persistence` and `lacunarity` have no effect. Defaults to 1. */
  octaves?: number;
  /** How much each layer of the built-in noise counts against the one before it, from 0 to 1. Only matters with more than one octave. Defaults to 0.2. */
  persistence?: number;
  /** How much finer each layer of the built-in noise is than the one before it. Only matters with more than one octave. Defaults to 1, which puts every layer at the same zoom. */
  lacunarity?: number;
  /** Noise to use instead of the built-in simplex noise: a function of positions in noise units that returns a number from -1 to 1. The scales and the rotation apply to it, but `octaves`, `persistence` and `lacunarity` do not, so wrap it in `createFractalNoise` if you want layers. */
  noise?: NoiseFunction;
  /** The chance of planting a tile, as fractions from 0 to 1 and not whole numbers like other ranges: `min` where the noise is at its lowest, rising to `max` where it is at its highest. Defaults to `{ min: 0, max: 0.25 }`, which leaves the lowest parts bare and makes the thickest woods a quarter full. A `max` of 1 packs the thickest parts solid. */
  density?: Range;
  /** The tile to plant. It need not be a tree: any `Tile` value goes. Defaults to `Tile.Tree`. */
  tile?: Tile;
}
