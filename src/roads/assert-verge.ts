import { assertWholeNumber } from '../core/assert-whole-number';
import { assertDistanceMetric } from '../core/assert-distance-metric';
import type { Verge } from './verge';

/** Throws a `RangeError` unless the verge's fields are valid. `name` is the option that holds it, for the message. */
export function assertVerge(name: string, verge: Verge): void {
  const { clearance = 0, falloff = 0, distance = 'chebyshev' } = verge;
  assertWholeNumber(`${name}.clearance`, clearance, 0);
  assertWholeNumber(`${name}.falloff`, falloff, 0);
  assertDistanceMetric('distance', distance);
}
