import type { Point } from '../core/point';
import type { Range } from '../core/range';
import type { AreaSize } from '../pipeline/area-size';
import type { MazeSymmetry } from './maze-options';

/** Options of `digMaze`. */
export interface DigMazeOptions {
  /** Weight of horizontal corridors against `verticalBias`. Only the ratio matters, so set both; a lone value against 0 means always. Defaults to 0. */
  horizontalBias?: number;
  /** Weight of vertical corridors against `horizontalBias`. Defaults to 0. */
  verticalBias?: number;
  /** Chance of turning a dead end into a loop: 0 is a perfect maze, 1 a braid maze. Defaults to 0. */
  loopChance?: number;
  /** Fraction of the maze to carve, from 0 to 1. Defaults to 1. */
  fill?: number;
  /** Preference for continuing straight, from 0 to 1. Defaults to 0. */
  straight?: number;
  /** A pattern the corridors follow around the center of the maze: `whirlpool` twirls them around it, `snowflake` makes them radiate from it. Defaults to `none`. */
  pattern?: MazeSymmetry;
  /** How strongly the pattern is enforced, from 0 (not at all) to 1 (every step follows it). Defaults to 1. */
  patternChance?: number;
  /** Where carving starts, in the coordinates of the map: a maze cell, with odd coordinates inside the map, that nothing has reserved. Only for a maze on the whole map. Defaults to the free cell nearest the middle. */
  start?: Point;
  /** The size of the box each copy goes in (see Areas), placed on the lattice: odd sizes at even coordinates. Defaults to the whole map. */
  area?: AreaSize;
  /** How many mazes to carve, each in its own box. Defaults to 1 to 1. */
  count?: Range;
}
