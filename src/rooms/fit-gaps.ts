import type { Range } from '../core/range';

/**
 * The gaps of the range that `placeClusteredRooms` can leave between two rooms, one
 * entry per value of the range, so they are drawn as evenly as the range is.
 * On the lattice a gap is rounded to an odd length, which keeps the walls on
 * even coordinates. A gap of 0, a shared wall,
 * needs a spacing of 1, and any other floors that are `spacing` apart.
 */
export function fitGaps(
  gap: Range,
  spacing: number,
  lattice: boolean,
): number[] {
  const gaps: number[] = [];
  for (let value = gap.min; value <= gap.max; ++value) {
    const length = lattice && value > 0 ? 2 * Math.ceil(value / 2) - 1 : value;
    // the floors are a wall, the corridor and another wall apart
    if (length === 0 ? spacing <= 1 : length + 2 >= spacing) {
      gaps.push(length);
    }
  }
  return gaps;
}
