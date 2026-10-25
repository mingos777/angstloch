import type { Grid } from '../core/grid';

export interface ForestResult {
  /** The generated map. */
  grid: Grid;
  /** The chance of a tree on every tile, from 0 to 1, row by row: `density[y * grid.width + x]`. A game can use it to tell dense woods from glades. */
  density: Float32Array;
}
