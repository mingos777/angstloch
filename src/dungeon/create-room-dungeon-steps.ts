import type { AnyStep } from '../pipeline/pipeline-chain';
import { carveCorridors } from './carve-corridors';
import { partitionRooms } from './partition-rooms';
import type { RoomDungeonStepOptions } from './room-dungeon-options';
import { scatterRooms } from './scatter-rooms';

/**
 * The steps of a room-first dungeon, in order: `scatterRooms`, or
 * `partitionRooms` when `partition` is given, then `carveCorridors`. Each step
 * takes only its own options. Every option is checked here, and a bad one, or
 * both `scatter` and `partition`, throws a `RangeError`.
 */
export function createRoomDungeonSteps(
  options: RoomDungeonStepOptions,
): AnyStep[] {
  const { scatter, partition, corridors } = options;
  if (scatter && partition) {
    throw new RangeError(
      'give at most one of scatter and partition, got both; for rooms of both kinds in one map, run their steps with pipeline',
    );
  }
  return [
    partition ? partitionRooms(partition) : scatterRooms(scatter),
    carveCorridors(corridors),
  ];
}
