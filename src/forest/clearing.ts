/** A clearing that was made, with the shape it was given. */
export interface Clearing {
  /** The tile column of the center. */
  x: number;
  /** The tile row of the center. */
  y: number;
  /** The approximate radius in tiles along the x axis, before `angle`. */
  radiusX: number;
  /** The approximate radius in tiles along the y axis, before `angle`. */
  radiusY: number;
  /** Clockwise rotation of the oval in degrees. */
  angle: number;
}
