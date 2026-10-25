/** Throws a `RangeError` unless the value is a finite number of at least 0. */
export function assertWeight(name: string, value: number): void {
  if (!(Number.isFinite(value) && value >= 0)) {
    throw new RangeError(
      `${name} must be a finite number >= 0, got ${String(value)}`,
    );
  }
}
