import type { Area } from './area';
import type { Position } from './position';
import type { Range } from './range';
import type { Rotation } from './rotation';
import type { TemplateCell } from './template-cell';

/** A player-made room: a rectangular design that is placed in a dungeon as it is. */
export interface RoomTemplate {
  /** The design, as rows of cells. Rows are non-empty and equally long. */
  cells: TemplateCell[][];
  /** Names the template in error messages. */
  name?: string;
  /** Number of copies to place, a `Range` of at least 0. Defaults to exactly 1. */
  count?: Range;
  /** Clockwise rotations the template may be placed in. Defaults to `[0]`. */
  rotate?: Rotation[];
  /** Whether the template may also be placed mirrored left to right. Defaults to `false`. */
  mirror?: boolean;
  /** Acceptable targets. One is picked at random per copy; copies beyond the list are placed at random. */
  positions?: Position[];
  /** Rectangles of the map to place copies in, for copies that have no position: one is picked at random, and the copy's whole bounding box must lie inside it. Copies are placed anywhere if there are none. */
  areas?: Area[];
  /** How exactly positions are honored, from 0 (ignored) to 1 (exact if possible). Defaults to 1. */
  positionAccuracy?: number;
}
