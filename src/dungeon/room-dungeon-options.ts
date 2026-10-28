import type { BaseOptions } from '../core/base-options';
import type { CarveCorridorsOptions } from './carve-corridors-options';
import type { PartitionRoomsOptions } from './partition-rooms-options';
import type { ScatterRoomsOptions } from './scatter-rooms-options';

/**
 * The options of a room-first dungeon that are not its size or its
 * randomness: one key per step, each holding the options of that step. At
 * most one of `scatter` and `partition` may be given.
 */
export interface RoomDungeonStepOptions {
  /** Rooms tried at random spots. See `scatterRooms`. The default when neither this nor `partition` is given. */
  scatter?: ScatterRoomsOptions;
  /** One room in each part of a binary space partition. See `partitionRooms`. Takes the place of `scatter`. */
  partition?: PartitionRoomsOptions;
  /** The corridors that join the rooms. See `carveCorridors`. It takes nothing from the rooms' options, so lattice or symmetric rooms want the same `placement`, `symmetry` and `symmetryChance` here. Defaults to the defaults of that step. */
  corridors?: CarveCorridorsOptions;
}

/** The options of `generateRoomDungeon`. */
export interface RoomDungeonOptions
  extends BaseOptions, RoomDungeonStepOptions {}
