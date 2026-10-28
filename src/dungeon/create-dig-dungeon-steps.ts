import type { AnyStep } from '../pipeline/pipeline-chain';
import { digCorridors } from './dig-corridors';
import type { DigDungeonStepOptions } from './dig-dungeon-options';
import { placeClusteredRooms } from './place-clustered-rooms';

/**
 * The steps of a grown dungeon, in order: `placeClusteredRooms`, then `digCorridors`.
 * Each step takes only its own options. Every option is checked here, and a
 * bad one throws a `RangeError`.
 */
export function createDigDungeonSteps(
  options: DigDungeonStepOptions,
): AnyStep[] {
  return [placeClusteredRooms(options.grow), digCorridors(options.corridors)];
}
