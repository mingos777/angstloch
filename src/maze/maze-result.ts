import type { Grid } from '../core/grid';
import type { Point } from '../core/point';
import type { PipelineFailure } from '../pipeline/pipeline-failure';
import type { Exit } from '../rooms/exit';
import type { Room } from '../rooms/room';

export interface MazeResult {
  /** The generated map. */
  grid: Grid;
  /** The cell where carving started. */
  start: Point;
  /** Door tiles on the map border, one per exit. Empty without `exits`. */
  exits: Point[];
  /** The rooms: templated ones first, then ordinary ones, with ids in that order. Empty without `rooms`. */
  rooms: Room[];
  /** The openings of the rooms into the maze, whether they have a door or not. Not to be confused with `exits`, which are on the map border. */
  roomExits: Exit[];
  /** How many times the maze was built, 1 or more: a map is built again when a step throws, up to 3 in all. */
  attempts: number;
  /** One entry per failed attempt, also when a later attempt succeeded. */
  failures: PipelineFailure[];
}
