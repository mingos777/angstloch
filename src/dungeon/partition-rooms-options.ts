import type { RoomPlacementOptions } from './room-placement-options';

/** Options of `partitionRooms`. */
export interface PartitionRoomsOptions extends RoomPlacementOptions {
  /** How regular the partition is, from 0 to 1: at 0 the cuts, the area to cut next and the rooms inside their areas are random; at 1 the biggest area is cut next, through the middle, and rooms sit in the middle of their areas. Defaults to 0. */
  spacingUniformity?: number;
}
