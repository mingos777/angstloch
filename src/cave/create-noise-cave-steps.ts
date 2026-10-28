import { addExits } from '../exits/add-exits';
import type { AnyStep } from '../pipeline/pipeline-chain';
import { carveNoiseCave } from './carve-noise-cave';
import { digCaveTunnels } from './dig-cave-tunnels';
import type { NoiseCaveStepOptions } from './noise-cave-options';

/**
 * The steps of a noise cave, in order: `carveNoiseCave`, then
 * `digCaveTunnels` unless `tunnels` is `false`, then `addExits` when `exits`
 * is given. Every option is checked here, and a bad one throws a `RangeError`.
 */
export function createNoiseCaveSteps(options: NoiseCaveStepOptions): AnyStep[] {
  const { cave, tunnels, exits } = options;
  const steps: AnyStep[] = [carveNoiseCave(cave)];
  if (tunnels !== false) {
    steps.push(digCaveTunnels(tunnels));
  }
  if (exits) {
    steps.push(addExits(exits));
  }
  return steps;
}
