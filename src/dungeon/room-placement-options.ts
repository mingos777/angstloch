import type { LayoutSymmetry } from '../core/layout-symmetry';
import type { Range } from '../core/range';
import type { AreaSize } from '../pipeline/area-size';
import type { Placement } from '../rooms/dungeon-options';
import type { RoomTemplate } from '../rooms/templates/room-template';

/** The options that `placeScatteredRooms` and `placePartitionedRooms` share: how big the rooms are, how many, how far apart, and where they go. */
export interface RoomPlacementOptions {
  /** Alignment of rooms: `free` rooms start on any tile, `lattice` rooms start on odd coordinates and have odd dimensions, like a maze. Defaults to `free`. */
  placement?: Placement;
  /** Room width in tiles, without the walls. With `lattice` placement only odd widths are used. Defaults to `{ min: 3, max: 7 }`. */
  roomWidth?: Range;
  /** Room height in tiles, without the walls. With `lattice` placement only odd heights are used. Defaults to `{ min: 3, max: 7 }`. */
  roomHeight?: Range;
  /** How alike room sizes are, from 0 (anything within the ranges) to 1 (every room has the middle size). Defaults to 0. */
  sizeUniformity?: number;
  /** Number of rooms in each area, templated rooms and mirror images included. Placing stops once `max` is reached; `fill` is only honored once `min` is reached. Defaults to at least 1 and no upper limit. */
  roomCount?: Range;
  /** Fewest wall tiles between the floors of two rooms, at least 1. With 1 rooms may share a wall; with 3 or more a corridor fits between them. With `lattice` placement it is rounded up to an odd number. Defaults to 1. */
  roomSpacing?: number;
  /** Target share of each area covered by room floors, from 0 to 1. The last room may overshoot it. Defaults to 0.12. */
  fill?: number;
  /** Prefabricated rooms, placed before the ordinary ones. Their positions and areas are in the coordinates of the `area`. A template that cannot be placed throws a `TemplatePlacementError`, which `pipeline` retries. Defaults to none. */
  templates?: RoomTemplate[];
  /** Whether templated rooms get mirror images, which follow `symmetry` always, whatever `symmetryChance` says. Defaults to false, which places each copy once. */
  templateSymmetry?: boolean;
  /** Chance that an `Exit` cell of a template gets a door, from 0 to 1; a `Door` cell always does. Defaults to 1. */
  doorChance?: number;
  /** Mirrors or rotates the rooms about the center of their area: `horizontal` (left to right), `vertical` (top to bottom), `both` or `rotational` (by 180°). Defaults to `none`. */
  symmetry?: LayoutSymmetry;
  /** How often a room gets its twins, from 0 (never) to 1 (always). Defaults to 1. */
  symmetryChance?: number;
  /** The size of the part of the map the rooms go in. Defaults to the whole map. A smaller area goes on a random spot where it and a margin of one tile are free, on the lattice with `lattice` placement. */
  area?: AreaSize;
  /** How many areas of rooms to place, each with rooms of its own, a `Range` of whole numbers of at least 0. One is picked. Defaults to `{ min: 1, max: 1 }`. */
  count?: Range;
}
