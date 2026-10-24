import { createRoomPlan } from './create-room-plan';
import type { RoomPlanOptions } from './create-room-plan';
import { partitionRooms } from './partition-rooms';
import type { Random } from './random';
import type { Room } from './room';
import type { RoomPartition } from './room-dungeon-options';
import { scatterRooms } from './scatter-rooms';

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
