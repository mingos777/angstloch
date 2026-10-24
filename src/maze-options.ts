import type { BaseOptions } from './base-options';
import type { Point } from './point';

/**
 * How corridors are forced into a pattern around the map centre:
 * `whirlpool` twirls them around it, `snowflake` makes them radiate from it.
 */
export type MazeSymmetry = 'none' | 'whirlpool' | 'snowflake';

export interface MazeOptions extends BaseOptions {
  /** Weight of horizontal corridors against `verticalBias`. Only the ratio matters, so set both; a lone value against 0 means always. Defaults to 0. */
  horizontalBias?: number;
  /** Weight of vertical corridors against `horizontalBias`. Defaults to 0. */
  verticalBias?: number;
  /** Chance of turning a dead end into a loop: 0 is a perfect maze, 1 a braid maze. Defaults to 0. */
  loopChance?: number;
  /** Fraction of the maze to carve, from 0 to 1. Defaults to 1. */
  fill?: number;
  /** Symmetry pattern. Defaults to `none`. */
  symmetry?: MazeSymmetry;
  /** How strongly the symmetry is enforced, from 0 (not at all) to 1 (every step follows the pattern). Defaults to 1. */
  symmetryChance?: number;
  /** Preference for continuing straight, from 0 to 1. Defaults to 0. */
  straight?: number;
  /** Minimum number of exits to add on the map border. Defaults to 0. */
  minExits?: number;
  /** Maximum number of exits to add. Defaults to `minExits`. */
  maxExits?: number;
  /** Where carving starts. Must be a cell with odd coordinates. Defaults to near the centre. */
  start?: Point;
}
