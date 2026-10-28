import type { BaseOptions } from '../core/base-options';
import type { AddExitsOptions } from '../exits/add-exits-options';
import type { DigCaveTunnelsOptions } from './dig-cave-tunnels-options';
import type { GrowCaveOptions } from './grow-cave-options';

/**
 * The options of a cellular-automaton cave that are not its size or its
 * randomness: one key per step of the cave, each holding the options of that
 * step.
 */
export interface CaveStepOptions {
  /** The caverns: the starting noise, the smoothing, the symmetry and which caverns to keep. See `growCave`. Defaults to the defaults of that step. */
  cave?: GrowCaveOptions;
  /** The tunnels that join the caverns into one. See `digCaveTunnels`. On by default, with the defaults of that step. `false` leaves the caverns apart. */
  tunnels?: DigCaveTunnelsOptions | false;
  /** Exits on the map border. See `addExits`. Defaults to no exits. */
  exits?: AddExitsOptions;
}

/** The options of `generateCave`. */
export interface CaveOptions extends BaseOptions, CaveStepOptions {}
