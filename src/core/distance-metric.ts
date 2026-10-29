/**
 * How a distance between two tiles is measured: `'chebyshev'` counts a
 * diagonal step as one tile (square shapes), `'manhattan'` counts only
 * orthogonal steps (diamonds), and `'euclidean'` counts a diagonal step as the
 * square root of 2 (circles). For a straight line between two tiles,
 * `'euclidean'` is the length of that line; for a walk, it is the sum of its
 * steps.
 */
export type DistanceMetric = 'chebyshev' | 'manhattan' | 'euclidean';
