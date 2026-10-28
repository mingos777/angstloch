import type { AnyStep } from '../pipeline/pipeline-chain';
import { carveCorridors } from './carve-corridors';
import type { DigDungeonStepOptions } from './dig-dungeon-options';
import { growRooms } from './grow-rooms';

/**
 * The steps of a grown dungeon, in order: `growRooms`, then `carveCorridors`.
 * Each step takes only its own options. Every option is checked here, and a
 * bad one throws a `RangeError`.
 */
export function createDigDungeonSteps(
  options: DigDungeonStepOptions,
): AnyStep[] {
  return [growRooms(options.grow), carveCorridors(options.corridors)];
}
