import { openExits } from '../exits/open-exits';
import type { AnyStep } from '../pipeline/pipeline-chain';
import { digNoiseCave } from './dig-noise-cave';
import { digCaveTunnels } from './dig-cave-tunnels';
import type { NoiseCaveStepOptions } from './noise-cave-options';

/**
 * The steps of a noise cave, in order: `digNoiseCave`, then
 * `digCaveTunnels` unless `tunnels` is `false`, then `openExits` when `exits`
 * is given. Every option is checked here, and a bad one throws a `RangeError`.
 */
export function createNoiseCaveSteps(options: NoiseCaveStepOptions): AnyStep[] {
  const { cave, tunnels, exits } = options;
  const steps: AnyStep[] = [digNoiseCave(cave)];
  if (tunnels !== false) {
    steps.push(digCaveTunnels(tunnels));
  }
  if (exits) {
    steps.push(openExits(exits));
  }
  return steps;
}
