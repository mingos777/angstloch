import { Tile } from './tile';

/** Throws a `RangeError` unless the value is one of the `Tile` values. */
export function assertTile(name: string, value: number): void {
  if (!(Object.values(Tile) as number[]).includes(value)) {
    throw new RangeError(`${name} must be a Tile value, got ${String(value)}`);
  }
}
