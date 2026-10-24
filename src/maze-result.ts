import type { Grid } from './grid';
import type { Point } from './point';

export interface MazeResult {
  /** The generated map. */
  grid: Grid;
  /** The cell where carving started. */
  start: Point;
  /** Door tiles on the map border, one per exit. */
  exits: Point[];
}
