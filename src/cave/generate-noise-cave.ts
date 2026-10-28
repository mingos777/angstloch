import type { CaveResult } from './cave-result';
import { createNoiseCaveSteps } from './create-noise-cave-steps';
import type { NoiseCaveOptions } from './noise-cave-options';
import { runCaveSteps } from './run-cave-steps';

/**
 * Generates a cave by thresholding noise, a ready-made composition of steps:
 * the tiles with the lowest noise become walls and the rest floor, or with
 * `shape: 'veins'` the floor follows the midpoint of the noise
 * (`digNoiseCave`), tunnels join the caverns into one (`digCaveTunnels`) and
 * exits are carved into the border (`openExits`), as far as their options are
 * given. The regions are measured on the finished map. For other
 * compositions, run the steps with `pipeline`.
 */
export function generateNoiseCave(options: NoiseCaveOptions): CaveResult {
  return runCaveSteps(options, createNoiseCaveSteps(options));
}
