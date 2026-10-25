/**
 * A 2D noise function: returns a float from -1 to 1 for any position, and
 * changes smoothly from one position to the next. Positions are in noise
 * units, so the function knows nothing about tiles or zoom.
 */
export type NoiseFunction = (x: number, y: number) => number;
