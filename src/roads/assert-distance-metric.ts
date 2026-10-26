import type { DistanceMetric } from './distance-metric';

const METRICS: readonly string[] = [
  'chebyshev',
  'manhattan',
  'euclidean',
] satisfies DistanceMetric[];

/** Throws a `RangeError` unless the value is a known way of measuring distance. */
export function assertDistanceMetric(value: string): void {
  if (!METRICS.includes(value)) {
    throw new RangeError(
      `distance must be one of ${METRICS.join(', ')}, got ${value}`,
    );
  }
}
