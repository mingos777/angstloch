import type { BaseOptions } from '../core/base-options';
import type { CorridorSymmetry } from '../rooms/corridor-symmetry';
import type { MazeRoomOptions } from './maze-room-options';
import type { Point } from '../core/point';
import type { Range } from '../core/range';
import type { RoomTemplate } from '../rooms/templates/room-template';

/** How corridors are forced into a pattern around the map center. */
export type MazeSymmetry = CorridorSymmetry;

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
  /** Where carving starts. Must be a cell with odd coordinates, and rooms keep away from it. Defaults to near the center. */
  start?: Point;
  /** Prefabricated rooms, placed first. They sit on the lattice of the maze, which the templates must fit, and the maze is carved around them. A template that cannot be placed throws a `TemplatePlacementError`. Cannot be combined with a `symmetry`. Defaults to none. */
  templates?: RoomTemplate[];
  /** Ordinary rectangular rooms to place in the maze. The maze is carved around them. Cannot be combined with a `symmetry`. Defaults to no rooms. */
  rooms?: MazeRoomOptions;
  /** Number of openings per room. A room may get more when it is needed to join parts of the maze that a room cuts off, and fewer when no maze cell is next to it. Defaults to 1 to 3. */
  exitsPerRoom?: Range;
  /** Chance that a room's opening gets a door, from 0 to 1. Openings without a door are plain gaps in the wall. Defaults to 1. */
  doorChance?: number;
}
