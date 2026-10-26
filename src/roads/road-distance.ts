import type { DistanceMetric } from './distance-metric';

/**
 * Measures how far every tile is from the nearest road tile, with the given
 * metric. Returns one number per tile, row by row: 0 on the roads themselves
 * and `Infinity` for the tiles that are further than `reach` tiles from every
 * road along a row or a column. The tiles in between, which can lie slightly
 * further away than `reach` by the metric, still get their exact distance.
 */
export function roadDistance(
  covered: Uint8Array,
  mapWidth: number,
  mapHeight: number,
  metric: DistanceMetric,
  reach: number,
): Float32Array {
  const distances = new Float32Array(mapWidth * mapHeight).fill(Infinity);
  for (let y = 0; y < mapHeight; ++y) {
    for (let x = 0; x < mapWidth; ++x) {
      if (!covered[y * mapWidth + x]) {
        continue;
      }
      const top = Math.max(0, y - reach);
      const bottom = Math.min(mapHeight - 1, y + reach);
      const left = Math.max(0, x - reach);
      const right = Math.min(mapWidth - 1, x + reach);
      for (let row = top; row <= bottom; ++row) {
        for (let column = left; column <= right; ++column) {
          const distance = measure(metric, column - x, row - y);
          const at = row * mapWidth + column;
          if (distance < (distances[at] ?? Infinity)) {
            distances[at] = distance;
          }
        }
      }
    }
  }
  return distances;
}

function measure(metric: DistanceMetric, dx: number, dy: number): number {
  const ax = Math.abs(dx);
  const ay = Math.abs(dy);
  switch (metric) {
    case 'chebyshev':
      return Math.max(ax, ay);
    case 'manhattan':
      return ax + ay;
    case 'euclidean':
      return Math.hypot(ax, ay);
  }
}
