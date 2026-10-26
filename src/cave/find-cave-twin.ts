import type { Point } from '../core/point';
import type { Transform } from '../rooms/templates/create-transforms';

/**
 * Returns the first of the mirror images of a tile in reading order (row by
 * row), which is the tile itself when it comes first. Every tile of a set of
 * twins agrees on it, so it is the one that the others copy.
 */
export function findCaveTwin(
  images: readonly Transform[],
  { x, y }: Point,
  width: number,
): Point {
  let source = { x, y };
  for (const { point } of images) {
    const image = point({ x, y });
    if (image.y * width + image.x < source.y * width + source.x) {
      source = image;
    }
  }
  return source;
}
