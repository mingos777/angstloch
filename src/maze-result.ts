import type { Grid } from './grid';
import type { Exit } from './exit';
import type { Point } from './point';
import type { Room } from './room';

export interface MazeResult {
  /** The generated map. */
  grid: Grid;
  /** The cell where carving started. */
  start: Point;
  /** Door tiles on the map border, one per exit. */
  exits: Point[];
  /** The rooms, in the order they were placed. Empty without the `rooms` option. */
  rooms: Room[];
  /** The openings of the rooms into the maze, whether they have a door or not. Not to be confused with `exits`, which are on the map border. */
  roomExits: Exit[];
}
