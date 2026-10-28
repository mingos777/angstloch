import type { AnyStep } from '../pipeline/pipeline-chain';
import { digCorridors } from './dig-corridors';
import { placePartitionedRooms } from './place-partitioned-rooms';
import type { RoomDungeonStepOptions } from './room-dungeon-options';
import { placeScatteredRooms } from './place-scattered-rooms';

/**
 * The steps of a room-first dungeon, in order: `placeScatteredRooms`, or
 * `placePartitionedRooms` when `partition` is given, then `digCorridors`. Each step
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
    partition ? placePartitionedRooms(partition) : placeScatteredRooms(scatter),
    digCorridors(corridors),
  ];
}
