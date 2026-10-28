import type { BaseOptions } from '../core/base-options';
import type { DigCorridorsOptions } from './dig-corridors-options';
import type { PlacePartitionedRoomsOptions } from './place-partitioned-rooms-options';
import type { PlaceScatteredRoomsOptions } from './place-scattered-rooms-options';

/**
 * The options of a room-first dungeon that are not its size or its
 * randomness: one key per step, each holding the options of that step. At
 * most one of `scatter` and `partition` may be given.
 */
export interface RoomDungeonStepOptions {
  /** Rooms tried at random spots. See `placeScatteredRooms`. The default when neither this nor `partition` is given. */
  scatter?: PlaceScatteredRoomsOptions;
  /** One room in each part of a binary space partition. See `placePartitionedRooms`. Takes the place of `scatter`. */
  partition?: PlacePartitionedRoomsOptions;
  /** The corridors that join the rooms. See `digCorridors`. It takes nothing from the rooms' options, so lattice or symmetric rooms want the same `placement`, `symmetry` and `symmetryChance` here. Defaults to the defaults of that step. */
  corridors?: DigCorridorsOptions;
}

/** The options of `generateRoomDungeon`. */
export interface RoomDungeonOptions
  extends BaseOptions, RoomDungeonStepOptions {}
