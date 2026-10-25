import type { DungeonOptions } from './dungeon-options';

/**
 * How rooms are placed: `scatter` tries random positions, `bsp` cuts the map
 * into areas by binary space partitioning and puts a room in each.
 */
export type RoomPartition = 'scatter' | 'bsp';

/**
 * How rooms are joined by corridors: `nearest` links the closest rooms first,
 * and `bsp` joins them the way a BSP dungeon does, by cutting the rooms in two
 * again and again and linking the two sides of every cut by their closest
 * rooms. `bsp-random` does the same, with a random room on each side of a cut.
 */
export type RoomConnection = 'nearest' | 'bsp' | 'bsp-random';

/** Options of `generateRoomDungeon`. */
export interface RoomDungeonOptions extends DungeonOptions {
  /** How rooms are placed. Defaults to `scatter`. */
  partition?: RoomPartition;
  /** How rooms are joined by corridors. Defaults to `nearest`. */
  connection?: RoomConnection;
  /** How evenly rooms are spread over the map, from 0 (anywhere) to 1 (as evenly as the method allows). Defaults to 0. */
  spacingUniformity?: number;
}
