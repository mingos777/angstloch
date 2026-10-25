/** Throws a `RangeError` unless the value is an integer of at least `min`. */
export function assertWholeNumber(
  name: string,
  value: number,
  min: number,
): void {
  if (!Number.isInteger(value) || value < min) {
    throw new RangeError(
      `${name} must be an integer >= ${String(min)}, got ${String(value)}`,
    );
  }
}
