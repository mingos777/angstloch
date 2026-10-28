import type { CaveOptions } from './cave-options';
import type { CaveResult } from './cave-result';
import { createCaveSteps } from './create-cave-steps';
import { runCaveSteps } from './run-cave-steps';

/**
 * Generates a cave with a cellular automaton, a ready-made composition of
 * steps: the map starts as random noise and is smoothed over a number of
 * passes until walls and floors clump into caverns (`growCave`), tunnels join
 * the caverns into one (`digCaveTunnels`) and exits are carved into the border
 * (`addExits`), as far as their options are given. The regions are measured on
 * the finished map. For other compositions, run the steps with `pipeline`.
 */
export function generateCave(options: CaveOptions): CaveResult {
  return runCaveSteps(options, createCaveSteps(options));
}
