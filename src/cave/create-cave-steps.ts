import { openExits } from '../exits/open-exits';
import type { AnyStep } from '../pipeline/pipeline-chain';
import { digVeins } from '../veins/dig-veins';
import type { CaveStepOptions } from './cave-options';
import { CAVE_TUNNEL_DEFAULTS } from './cave-tunnel-defaults';
import { digCellularCave } from './dig-cellular-cave';

/**
 * The steps of a cellular-automaton cave, in order: `digCellularCave`, then
 * `digVeins` for the tunnels unless `tunnels` is `false`, then `openExits`
 * when `exits` is given. Every option is checked here, and a bad one throws a
 * `RangeError`.
 */
export function createCaveSteps(options: CaveStepOptions): AnyStep[] {
  const { cave, tunnels, exits } = options;
  const steps: AnyStep[] = [digCellularCave(cave)];
  if (tunnels !== false) {
    steps.push(digVeins({ ...CAVE_TUNNEL_DEFAULTS, ...tunnels }));
  }
  if (exits) {
    steps.push(openExits(exits));
  }
  return steps;
}
