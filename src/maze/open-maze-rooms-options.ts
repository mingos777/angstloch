import type { Range } from '../core/range';

/** Options of `openMazeRooms`. */
export interface OpenMazeRoomsOptions {
  /** Number of openings per room, a `Range` of whole numbers of at least 1. A room may get more when it is needed to join parts of the maze that a room cuts off, and fewer when no maze cell is next to it. Defaults to 1 to 3. */
  exitsPerRoom?: Range;
  /** Chance that a room's opening gets a door, from 0 to 1. Openings without a door are plain gaps in the wall. The fixed exits of templates were decided when the rooms were placed. Defaults to 1. */
  doorChance?: number;
}
