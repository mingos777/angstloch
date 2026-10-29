import { assertRange } from '../core/assert-range';
import type { Range } from '../core/range';
import type { AreaSize } from './area-size';

/**
 * Checks the `area` and `count` options of a feature step against the size of
 * the map, for the `validate` of the step. Throws a `RangeError` unless the
 * ranges are whole numbers that start at 1 (`count` at 0), an area is no larger
 * than the map, and `count` allows more than one copy only where two can fit,
 * which they cannot when every copy is as big as the map.
 */
export function assertAreaSize(
  area: AreaSize,
  count: Range,
  width: number,
  height: number,
): void {
  assertRange('count', count, 0);
  for (const [name, range, limit] of [
    ['area.width', area.width, width],
    ['area.height', area.height, height],
  ] as const) {
    if (range) {
      assertRange(name, range, 1);
      if (range.max > limit) {
        throw new RangeError(
          `${name}.max (${String(range.max)}) must not exceed the size of the map (${String(limit)})`,
        );
      }
    }
  }
  const wholeMap =
    (area.width?.min ?? width) === width &&
    (area.height?.min ?? height) === height;
  if (count.max > 1 && wholeMap) {
    throw new RangeError(
      `count.max (${String(count.max)}) must be 1 when the area is as big as the map, since two copies cannot fit`,
    );
  }
}
