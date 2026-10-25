import { createRoomPlan } from '../rooms/create-room-plan';
import type { RoomPlanOptions } from '../rooms/create-room-plan';
import { partitionRooms } from '../rooms/partition-rooms';
import type { Random } from '../core/random';
import type { Room } from '../rooms/room';
import type { RoomPartition } from '../rooms/room-dungeon-options';
import { scatterRooms } from '../rooms/scatter-rooms';

export interface PlaceRoomsOptions extends RoomPlanOptions {
  partition: RoomPartition;
}

/** Places non-overlapping rooms on the map with the chosen partitioning method. */
export function placeRooms(random: Random, options: PlaceRoomsOptions): Room[] {
  const plan = createRoomPlan(options);
  if (!plan) {
    return [];
  }
  return options.partition === 'bsp'
    ? partitionRooms(random, plan)
    : scatterRooms(random, plan);
}
