import type { BaseOptions } from '../core/base-options';
import type { DigCorridorsOptions } from './dig-corridors-options';
import type { PlaceClusteredRoomsOptions } from './place-clustered-rooms-options';

/**
 * The options of a grown dungeon that are not its size or its randomness: one
 * key per step, each holding the options of that step.
 */
export interface DigDungeonStepOptions {
  /** The rooms, grown from a room in the middle. See `placeClusteredRooms`. Defaults to the defaults of that step. */
  grow?: PlaceClusteredRoomsOptions;
  /** The corridors that join the rooms. See `digCorridors`. It takes nothing from the rooms' options, so lattice or symmetric rooms want the same `placement`, `symmetry` and `symmetryChance` here. Defaults to the defaults of that step. */
  corridors?: DigCorridorsOptions;
}

/** The options of `generateDigDungeon`. */
export interface DigDungeonOptions extends BaseOptions, DigDungeonStepOptions {}
