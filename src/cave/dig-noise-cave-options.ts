import type { NoiseFunction } from '../noise/noise-function';
import type { CaveAreaOptions } from './cave-area-options';
import type { NoiseCaveShape } from './noise-cave-shape';

/** Options of `digNoiseCave`. */
export interface DigNoiseCaveOptions extends CaveAreaOptions {
  /** Which part of the noise becomes floor. Defaults to `blobs`. */
  shape?: NoiseCaveShape;
  /** The share of the tiles of the area that become wall, from 0 (no walls) to 1 (all walls). The step picks the threshold of the noise that gives this share, whatever the noise looks like. With `borderWalls`, the border is walled on top of it, so the share counts the inner tiles only. Defaults to 0.45. */
  fill?: number;
  /** Rounds off the corners of the area by pulling the walls in toward them, so that caverns close off before they run into a corner. It is the distance in tiles from a corner over which the pull reaches, a whole number of 0 or more. The pull is strongest in the corner itself and fades out smoothly with the distance, and straight edges are left alone. The share of walls stays `fill`. Defaults to 4, and 0 turns it off. */
  cornerBias?: number;
  /** Size in tiles of a feature of the noise along the x axis, before rotation. Larger values make broader caverns. Defaults to 12. */
  scaleX?: number;
  /** Size in tiles of a feature of the noise along the y axis, before rotation. Defaults to 12. */
  scaleY?: number;
  /** Clockwise rotation of the noise in degrees, which makes stretched caverns run diagonally. Defaults to 0. */
  rotation?: number;
  /** Number of layers of the built-in noise, each finer than the one before, which roughen the edges. Defaults to 3. */
  octaves?: number;
  /** How much each layer of the built-in noise counts against the one before it, from 0 to 1. Defaults to 0.5. */
  persistence?: number;
  /** How much finer each layer of the built-in noise is than the one before it. Defaults to 2. */
  lacunarity?: number;
  /** Noise to use instead of the built-in simplex noise: a function of positions in noise units that returns a number from -1 to 1. The scales and the rotation apply to it, but `octaves`, `persistence` and `lacunarity` do not. It is sampled at the position of a tile on the map, so two caves in two areas differ. */
  noise?: NoiseFunction;
  /** Number of passes of the cave automaton (4-5 rule on 8 neighbors) to smooth the thresholded noise with. Defaults to 0, which leaves it as it is. */
  iterations?: number;
}
