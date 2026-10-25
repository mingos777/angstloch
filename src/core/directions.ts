import type { Point } from './point';

/** Unit steps in the order north, east, south, west. The opposite of `i` is `(i + 2) % 4`. */
export const DIRECTIONS: readonly Point[] = [
  { x: 0, y: -1 },
  { x: 1, y: 0 },
  { x: 0, y: 1 },
  { x: -1, y: 0 },
];
