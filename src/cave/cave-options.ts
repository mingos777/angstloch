import type { BaseOptions } from '../core/base-options';
import type { OpenExitsOptions } from '../exits/open-exits-options';
import type { DigVeinsOptions } from '../veins/dig-veins-options';
import type { DigCellularCaveOptions } from './dig-cellular-cave-options';

/**
 * The options of a cellular-automaton cave that are not its size or its
 * randomness: one key per step of the cave, each holding the options of that
 * step.
 */
export interface CaveStepOptions {
  /** The caverns: the starting noise, the smoothing, the symmetry and which caverns to keep. See `digCellularCave`. Defaults to the defaults of that step. */
  cave?: DigCellularCaveOptions;
  /** The tunnels that join the caverns into one. See `digVeins`. On by default, with single-width veins and a `density` of 0, so that the veins only join the caverns. `false` leaves the caverns apart. */
  tunnels?: DigVeinsOptions | false;
  /** Exits on the map border. See `openExits`. Defaults to no exits. */
  exits?: OpenExitsOptions;
}

/** The options of `generateCave`. */
export interface CaveOptions extends BaseOptions, CaveStepOptions {}
