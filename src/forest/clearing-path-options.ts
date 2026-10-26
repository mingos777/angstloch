/** The path that leads to a clearing, a narrow track from the nearest road, or from the border of the map when there are no roads. */
export interface ClearingPathOptions {
  /** Width of the path in tiles, a whole number of at least 1. Defaults to 1. */
  width?: number;
  /** How much the path winds, from 0 (straight) to 1. Defaults to 0.3. */
  windiness?: number;
}
