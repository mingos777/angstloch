import type { Range } from './range';

/** Throws a `RangeError` unless both ends are integers of at least `min` and `range.min <= range.max`. */
export function assertRange(name: string, range: Range, min: number): void {
  for (const [end, value] of [
    ['min', range.min],
    ['max', range.max],
  ] as const) {
    if (!Number.isInteger(value) || value < min) {
      throw new RangeError(
        `${name}.${end} must be an integer >= ${String(min)}, got ${String(value)}`,
      );
    }
  }
  if (range.min > range.max) {
    throw new RangeError(
      `${name}.min (${String(range.min)}) must not exceed ${name}.max (${String(range.max)})`,
    );
  }
}
