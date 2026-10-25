import type { BaseOptions } from './base-options';
import type { Range } from './range';
import type { SymmetryOptions } from './symmetry-options';

/**
 * How rooms are aligned on the map. With `free`, a room may start on any tile.
 * With `lattice` rooms start on odd coordinates and have odd dimensions, which
 * keeps everything on the same lattice as a maze.
 */
export type Placement = 'free' | 'lattice';

/** Options shared by every dungeon generator. */
export interface DungeonOptions extends BaseOptions, SymmetryOptions {
  /** Alignment of rooms. Defaults to `free`. */
  placement?: Placement;
  /** Room width in tiles. Defaults to 3 to 7. With `lattice` placement only odd widths are used. */
  roomWidth?: Range;
  /** Room height in tiles. Defaults to 3 to 7. With `lattice` placement only odd heights are used. */
  roomHeight?: Range;
  /** How alike room sizes are, from 0 (anything within the ranges) to 1 (every room has the middle size). Defaults to 0. */
  sizeUniformity?: number;
  /** Number of rooms to place. Generation stops once `max` is reached; `fill` is only honoured once `min` is reached. Defaults to at least 1 and no upper limit. */
  roomCount?: Range;
  /** Fewest wall tiles between the floors of two rooms, at least 1. With 1 rooms may sit right next to each other and share a door; with 3 or more a corridor fits between them. With `lattice` placement it is rounded up to an odd number. Defaults to 1. */
  roomSpacing?: number;
  /** Target share of the map covered by room floors, from 0 to 1. The last room may overshoot it. Defaults to 0.12. */
  fill?: number;
  /** Number of exits per room, whether they have doors or not. Each room draws its own number from the range. A room with fewer links than that gets more, which makes loops; a room with more links shares its exits and the corridors branch off outside. Best effort: a room may end up with more or fewer exits if routing demands it. Defaults to 1 to 3. */
  exitsPerRoom?: Range;
  /** Chance of adding an extra corridor between two nearby rooms that are connected already, from 0 to 1. Each pair of neighbours gets one roll. Defaults to 0.1. */
  loopChance?: number;
  /** Chance that a corridor sprouts a branch that leads nowhere, from 0 to 1. Defaults to 0. */
  deadEndChance?: number;
  /** Chance that an exit gets a door, from 0 to 1. Exits without a door are plain openings in the wall. Defaults to 1. */
  doorChance?: number;
  /** Preference of corridors for going straight, from 0 (they wander) to 1 (they turn as little as possible). Defaults to 0.5. */
  straight?: number;
  /** Weight of horizontal corridor sections against `verticalBias`. Only the ratio matters, so set both; a lone value against 0 means always. Defaults to 0. */
  horizontalBias?: number;
  /** Weight of vertical corridor sections against `horizontalBias`. Defaults to 0. */
  verticalBias?: number;
}
