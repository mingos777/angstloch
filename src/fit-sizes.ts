import type { Range } from './range';

/** Narrows a size range to the sizes that are valid and fit between the map edges. */
export function fitSizes(
  range: Range,
  step: number,
  available: number,
): Range | undefined {
  const min = step === 1 ? range.min : range.min + ((range.min + 1) % 2);
  const largest = Math.min(range.max, available);
  const max = step === 1 ? largest : largest - ((largest + 1) % 2);
  if (min <= max) {
    return { min, max };
  }
  // an even-only range such as 4 to 4 is rounded up to the next odd size
  return min <= available ? { min, max: min } : undefined;
}
