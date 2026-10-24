/** Throws a `RangeError` unless both dimensions are integers of at least `min`. */
export function assertDimensions(width: number, height: number, min = 1): void {
  for (const [name, value] of [
    ['width', width],
    ['height', height],
  ] as const) {
    if (!Number.isInteger(value) || value < min) {
      throw new RangeError(
        `${name} must be an integer >= ${String(min)}, got ${String(value)}`,
      );
    }
  }
}
