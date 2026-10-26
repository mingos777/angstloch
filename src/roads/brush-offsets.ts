import type { Point } from '../core/point';

/**
 * Lists the offsets from a centerline tile of the tiles that a road of the
 * given width covers there. Narrow roads are squares, and wider ones have
 * rounded corners so that a road is about as wide in every direction.
 */
export function brushOffsets(width: number): Point[] {
  const start = -Math.floor((width - 1) / 2);
  const middle = (width - 1) / 2;
  const offsets: Point[] = [];
  for (let j = 0; j < width; ++j) {
    for (let i = 0; i < width; ++i) {
      if (Math.hypot(i - middle, j - middle) <= width / 2) {
        offsets.push({ x: start + i, y: start + j });
      }
    }
  }
  return offsets;
}
