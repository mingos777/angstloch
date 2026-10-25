export interface NoiseTransformOptions {
  /** Size in tiles of a feature of the noise along the x axis, before rotation. Larger is a smoother, more stretched landscape. Defaults to 1. */
  scaleX?: number;
  /** Size in tiles of a feature of the noise along the y axis, before rotation. Defaults to 1. */
  scaleY?: number;
  /** Clockwise rotation in degrees, any number. The stretched axes turn with it, so a rotation of 45 with a larger `scaleX` makes shapes that run down and to the right. Defaults to 0. */
  rotation?: number;
}
