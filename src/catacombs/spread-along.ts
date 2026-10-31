/**
 * Where things of a size go along a stretch, as many as fit with `spacing`
 * between them, centered on it: the first coordinate of each. None when not
 * even one fits.
 */
export function spreadAlong(
  start: number,
  length: number,
  size: number,
  spacing: number,
): number[] {
  if (length < size) {
    return [];
  }
  const count = Math.floor((length + spacing) / (size + spacing));
  const offset = Math.floor(
    (length - count * size - (count - 1) * spacing) / 2,
  );
  return Array.from(
    { length: count },
    (_, index) => start + offset + index * (size + spacing),
  );
}
