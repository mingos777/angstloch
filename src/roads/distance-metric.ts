/**
 * How a distance between two tiles is measured: `'chebyshev'` counts a
 * diagonal step as one tile (square shapes), `'manhattan'` counts only
 * orthogonal steps (diamonds), and `'euclidean'` is the straight line between
 * the tile centers, so a diagonal step is the square root of 2 (circles).
 */
export type DistanceMetric = 'chebyshev' | 'manhattan' | 'euclidean';
