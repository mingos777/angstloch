import type { LayoutSymmetry } from '../core/layout-symmetry';
import type { Range } from '../core/range';
import type { CorridorSymmetry } from '../rooms/corridor-symmetry';
import type { Placement } from '../rooms/dungeon-options';
import type { RoomConnection } from './room-connection';

/** Options of `digCorridors`. */
export interface DigCorridorsOptions {
  /** How rooms are joined: `nearest` links the closest rooms first, `bsp` cuts the rooms in two again and again and links the two sides of every cut by their closest rooms, and `bsp-random` does the same with a random room on each side. Defaults to `nearest`. */
  connection?: RoomConnection;
  /** Number of exits per room, whether they have doors or not. Each room draws its own number from the range. A room with fewer links than that gets more, which makes loops; a room with more links shares its exits and the corridors branch off outside. Best effort. Defaults to `{ min: 1, max: 3 }`. */
  exitsPerRoom?: Range;
  /** Chance of an extra corridor between two nearby rooms that are joined already, from 0 to 1. Each pair of neighbors gets one roll. Defaults to 0.1. */
  loopChance?: number;
  /** Chance that a corridor sprouts a branch that leads nowhere, from 0 to 1. Defaults to 0. */
  deadEndChance?: number;
  /** Chance that an exit gets a door, from 0 to 1. Exits without a door are plain openings in the wall. The doors of templates were decided when they were placed. Defaults to 1. */
  doorChance?: number;
  /** Preference of corridors for going straight, from 0 (they wander) to 1 (they turn as little as possible). Defaults to 0.5. */
  straight?: number;
  /** Weight of horizontal corridor sections against `verticalBias`. Only the ratio matters, so set both; a lone value against 0 means always. Defaults to 0. */
  horizontalBias?: number;
  /** Weight of vertical corridor sections against `horizontalBias`. Defaults to 0. */
  verticalBias?: number;
  /** Alignment of corridors and exits: `lattice` keeps them on odd coordinates, like a maze, for rooms placed on the lattice. Defaults to `free`. */
  placement?: Placement;
  /** Mirrors or rotates corridors, exits and doors about the center of the map: `horizontal`, `vertical`, `both` or `rotational`. Rooms are mirrored by the step that places them; a corridor gets its twins only where the rooms it joins have theirs. Defaults to `none`. */
  symmetry?: LayoutSymmetry;
  /** How often a corridor gets its twins, from 0 (never) to 1 (always). Defaults to 1. */
  symmetryChance?: number;
  /** Makes corridors follow the pattern of a maze: `whirlpool` twirls them around the center and `snowflake` makes them radiate from it. Defaults to `none`. */
  corridorSymmetry?: CorridorSymmetry;
  /** How strongly corridors follow `corridorSymmetry`, from 0 (not at all) to 1 (every choice of direction does). Defaults to 1. */
  corridorSymmetryChance?: number;
}
