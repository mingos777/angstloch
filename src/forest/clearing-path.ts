import type { Point } from '../core/point';

/** A path that was asked for, to lead to the center of a clearing. */
export interface ClearingPath {
  /** The center of the clearing, where the path ends. */
  to: Point;
  /** Width of the path in tiles. */
  width: number;
  /** How much the path winds, from 0 to 1. */
  windiness: number;
  /** Position of the clearing in the clearings that were made. */
  clearing: number;
  /** Tiles where the path stops short, since it may not enter them: the cells of the clearing's template. */
  stopAt?: (x: number, y: number) => boolean;
}
