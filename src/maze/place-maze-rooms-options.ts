import type { Point } from '../core/point';
import type { Range } from '../core/range';
import type { AreaSize } from '../pipeline/area-size';
import type { RoomTemplate } from '../rooms/templates/room-template';

/** Options of `placeMazeRooms`. */
export interface PlaceMazeRoomsOptions {
  /** How many ordinary rectangular rooms to place, a `Range` of whole numbers of at least 0. One is picked, and fewer rooms are placed when no more fit. Defaults to `{ min: 1, max: 1 }`. */
  roomCount?: Range;
  /** Room width in tiles, without the walls. Only odd widths are used, since rooms sit on the lattice of the maze. Defaults to `{ min: 3, max: 7 }`. */
  roomWidth?: Range;
  /** Room height in tiles, without the walls. Only odd heights are used. Defaults to `{ min: 3, max: 7 }`. */
  roomHeight?: Range;
  /** How alike room sizes are, from 0 (anything within the ranges) to 1 (every room has the middle size). Defaults to 0. */
  sizeUniformity?: number;
  /** Prefabricated rooms, placed before the ordinary ones. They sit on the lattice of the maze, which the templates must fit, and their positions and areas are in the coordinates of the `area`. A template that cannot be placed throws a `TemplatePlacementError`. Defaults to none. */
  templates?: RoomTemplate[];
  /** Chance that an `Exit` cell of a template gets a door, from 0 to 1; a `Door` cell always does. The other openings are decided when the rooms are opened. Defaults to 1. */
  doorChance?: number;
  /** A tile, in the coordinates of the map, that the rooms leave free, such as the cell a maze starts from. The ordinary rooms keep off it; a template that covers it fails the attempt, which `pipeline` retries. Defaults to none. */
  keepClear?: Point;
  /** The size of the box the rooms go in (see Areas), placed on the lattice: odd sizes at even coordinates. Defaults to the whole map. */
  area?: AreaSize;
}
