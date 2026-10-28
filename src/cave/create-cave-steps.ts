import { addExits } from '../exits/add-exits';
import type { AnyStep } from '../pipeline/pipeline-chain';
import type { CaveStepOptions } from './cave-options';
import { digCaveTunnels } from './dig-cave-tunnels';
import { growCave } from './grow-cave';

/**
 * The steps of a cellular-automaton cave, in order: `growCave`, then
 * `digCaveTunnels` unless `tunnels` is `false`, then `addExits` when `exits`
 * is given. Every option is checked here, and a bad one throws a `RangeError`.
 */
export function createCaveSteps(options: CaveStepOptions): AnyStep[] {
  const { cave, tunnels, exits } = options;
  const steps: AnyStep[] = [growCave(cave)];
  if (tunnels !== false) {
    steps.push(digCaveTunnels(tunnels));
  }
  if (exits) {
    steps.push(addExits(exits));
  }
  return steps;
}
