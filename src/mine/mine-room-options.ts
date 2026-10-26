import type { Range } from '../core/range';

/** Ordinary rectangular rooms placed in a mine. */
export interface MineRoomOptions {
  /** Number of rooms. The number is drawn from the range, and fewer rooms are placed when no more fit. Defaults to 1. */
  count?: Range;
  /** Room width in tiles, without the walls. Defaults to 3 to 7. */
  width?: Range;
  /** Room height in tiles, without the walls. Defaults to 3 to 7. */
  height?: Range;
  /** How alike room sizes are, from 0 (anything within the ranges) to 1 (every room has the middle size). Defaults to 0. */
  sizeUniformity?: number;
}
