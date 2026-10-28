import type { Range } from '../core/range';
import type { RoomTemplate } from '../rooms/templates/room-template';

/** Options of `placeMineRooms`. */
export interface PlaceMineRoomsOptions {
  /** How many ordinary rectangular rooms to place, a `Range` of whole numbers of at least 0. One is picked, and fewer rooms are placed when no more fit. Defaults to `{ min: 1, max: 1 }`. */
  roomCount?: Range;
  /** Room width in tiles, without the walls. Defaults to `{ min: 3, max: 7 }`. */
  roomWidth?: Range;
  /** Room height in tiles, without the walls. Defaults to `{ min: 3, max: 7 }`. */
  roomHeight?: Range;
  /** How alike room sizes are, from 0 (anything within the ranges) to 1 (every room has the middle size). Defaults to 0. */
  sizeUniformity?: number;
  /** Prefabricated rooms, placed before the ordinary ones and joined to the floor from their exits. A template that cannot be placed or joined fails the attempt, which `pipeline` retries with a new map. Defaults to none. */
  templates?: RoomTemplate[];
  /** Number of openings per room, a `Range` of whole numbers, 1 or more. The fixed exits of a template count, and more are opened from the optional ones. Defaults to `{ min: 1, max: 3 }`. */
  exitsPerRoom?: Range;
  /** Chance that a room's opening gets a door, from 0 to 1. Openings without a door are plain gaps in the wall. Defaults to 1. */
  doorChance?: number;
  /** Width of the tunnels that join the rooms to the floor, in whole tiles, as a `Range`. One is picked for every tunnel. Defaults to `{ min: 1, max: 2 }`. */
  veinWidth?: Range;
  /** How much the tunnels wind, from 0 (straight) to 1. Defaults to 0.5. */
  veinWindiness?: number;
}
