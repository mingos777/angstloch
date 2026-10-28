import type { Point } from '../core/point';
import type { Start } from './dungeon-builder';

/** A corridor to carve. */
export interface OperationPath {
  /** Every tile, in order. */
  tiles: Point[];
  /** The id of the room whose link carves it. */
  owner: number;
  /** Whether it may cross other corridors. */
  crossing: boolean;
  /** How many tiles at the start belong to an existing corridor. */
  fixed: number;
  /** The direction of the first tile that is not fixed, when no tile before it tells. */
  direction?: number;
}

/** An exit to open. */
export interface OperationExit {
  position: Point;
  rooms: number[];
  start?: Start;
  /** Whether the exit gets a door, which is decided when the operation is placed if left out. */
  door?: boolean;
}

/** Everything that adds one link or one dead end to a dungeon, so that it can be done again as a mirror image. */
export interface Operation {
  paths: OperationPath[];
  exits: OperationExit[];
  /** Pairs of rooms that now have a link between them. */
  links: [number, number][];
  /** Pairs of rooms that now belong to the same group. */
  joins: [number, number][];
}
