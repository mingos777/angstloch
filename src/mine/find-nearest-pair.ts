import type { Point } from '../core/point';

/** The two tiles of a pair, one from each list, that lie nearest each other, and the distance between them. */
export interface NearestPair<T extends Point> {
  source: Point;
  target: T;
  distance: number;
}

/**
 * Finds the pair of tiles, one of the sources and one of the targets, that lie
 * nearest each other, as the crow flies. Returns nothing when either list is
 * empty.
 */
export function findNearestPair<T extends Point>(
  sources: readonly Point[],
  targets: readonly T[],
): NearestPair<T> | undefined {
  let best: NearestPair<T> | undefined;
  let bestSquared = Infinity;
  for (const source of sources) {
    for (const target of targets) {
      const squared =
        (source.x - target.x) * (source.x - target.x) +
        (source.y - target.y) * (source.y - target.y);
      if (squared < bestSquared) {
        bestSquared = squared;
        best = { source, target, distance: 0 };
      }
    }
  }
  return best && { ...best, distance: Math.sqrt(bestSquared) };
}
