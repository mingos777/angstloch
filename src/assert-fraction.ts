/** Throws a `RangeError` unless the value is a number from 0 to 1. */
export function assertFraction(name: string, value: number): void {
  if (!(value >= 0 && value <= 1)) {
    throw new RangeError(
      `${name} must be between 0 and 1, got ${String(value)}`,
    );
  }
}
