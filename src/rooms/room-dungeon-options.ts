import type { DungeonOptions } from './dungeon-options';

/**
 * How rooms are placed: `scatter` tries random positions, `bsp` cuts the map
 * into areas by binary space partitioning and puts a room in each.
 */
export type RoomPartition = 'scatter' | 'bsp';

/** Options of `generateRoomDungeon`. */
export interface RoomDungeonOptions extends DungeonOptions {
  /** How rooms are placed. Defaults to `scatter`. */
  partition?: RoomPartition;
  /** How evenly rooms are spread over the map, from 0 (anywhere) to 1 (as evenly as the method allows). Defaults to 0. */
  spacingUniformity?: number;
}
