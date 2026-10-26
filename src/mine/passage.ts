import type { Point } from '../core/point';

/** A passage that was carved. */
export interface Passage {
  /** Tiles along the middle of the passage, from where it starts to where it ends. Each one touches the one before it along an edge. */
  tiles: Point[];
  /** Width in tiles. */
  width: number;
}
