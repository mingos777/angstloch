import type { BaseOptions } from '../core/base-options';
import type { CarveCorridorsOptions } from './carve-corridors-options';
import type { GrowRoomsOptions } from './grow-rooms-options';

/**
 * The options of a grown dungeon that are not its size or its randomness: one
 * key per step, each holding the options of that step.
 */
export interface DigDungeonStepOptions {
  /** The rooms, grown from a room in the middle. See `growRooms`. Defaults to the defaults of that step. */
  grow?: GrowRoomsOptions;
  /** The corridors that join the rooms. See `carveCorridors`. It takes nothing from the rooms' options, so lattice or symmetric rooms want the same `placement`, `symmetry` and `symmetryChance` here. Defaults to the defaults of that step. */
  corridors?: CarveCorridorsOptions;
}

/** The options of `generateDigDungeon`. */
export interface DigDungeonOptions extends BaseOptions, DigDungeonStepOptions {}
