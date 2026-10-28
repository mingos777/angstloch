import type { BaseOptions } from '../core/base-options';
import type { OpenExitsOptions } from '../exits/open-exits-options';
import type { DigNoiseCaveOptions } from './dig-noise-cave-options';
import type { DigCaveTunnelsOptions } from './dig-cave-tunnels-options';

/**
 * The options of a noise cave that are not its size or its randomness: one
 * key per step of the cave, each holding the options of that step.
 */
export interface NoiseCaveStepOptions {
  /** The caverns: the noise, its threshold, the symmetry and which caverns to keep. See `digNoiseCave`. Defaults to the defaults of that step. */
  cave?: DigNoiseCaveOptions;
  /** The tunnels that join the caverns into one. See `digCaveTunnels`. On by default, with the defaults of that step. `false` leaves the caverns apart. */
  tunnels?: DigCaveTunnelsOptions | false;
  /** Exits on the map border. See `openExits`. Defaults to no exits. */
  exits?: OpenExitsOptions;
}

/** The options of `generateNoiseCave`. */
export interface NoiseCaveOptions extends BaseOptions, NoiseCaveStepOptions {}
