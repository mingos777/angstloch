import type { Range } from './range';

/** Ordinary rectangular rooms placed inside a maze. */
export interface MazeRoomOptions {
  /** Number of rooms. The number is drawn from the range, and fewer rooms are placed when no more fit. Defaults to 1. */
  count?: Range;
  /** Room width in tiles. Only odd widths are used, since rooms sit on the lattice of the maze. Defaults to 3 to 7. */
  width?: Range;
  /** Room height in tiles. Only odd heights are used. Defaults to 3 to 7. */
  height?: Range;
  /** How alike room sizes are, from 0 (anything within the ranges) to 1 (every room has the middle size). Defaults to 0. */
  sizeUniformity?: number;
}
