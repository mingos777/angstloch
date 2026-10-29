import { openExits } from '../exits/open-exits';
import type { AnyStep } from '../pipeline/pipeline-chain';
import { digVeins } from '../veins/dig-veins';
import { CAVE_TUNNEL_DEFAULTS } from './cave-tunnel-defaults';
import { digNoiseCave } from './dig-noise-cave';
import type { NoiseCaveStepOptions } from './noise-cave-options';

/**
 * The steps of a noise cave, in order: `digNoiseCave`, then
 * `digVeins` for the tunnels unless `tunnels` is `false`, then `openExits`
 * when `exits` is given. Every option is checked here, and a bad one throws a `RangeError`.
 */
export function createNoiseCaveSteps(options: NoiseCaveStepOptions): AnyStep[] {
  const { cave, tunnels, exits } = options;
  const steps: AnyStep[] = [digNoiseCave(cave)];
  if (tunnels !== false) {
    steps.push(digVeins({ ...CAVE_TUNNEL_DEFAULTS, ...tunnels }));
  }
  if (exits) {
    steps.push(openExits(exits));
  }
  return steps;
}
