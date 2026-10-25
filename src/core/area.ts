/** A rectangle of the map, in tiles. */
export interface Area {
  /** Column of the left edge. */
  x: number;
  /** Row of the top edge. */
  y: number;
  /** Width in tiles, at least 1. */
  width: number;
  /** Height in tiles, at least 1. */
  height: number;
}
