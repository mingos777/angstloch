import type { RoomConnection } from './room-connection';

const CONNECTIONS: readonly string[] = [
  'nearest',
  'bsp',
  'bsp-random',
] satisfies RoomConnection[];

/** Throws a `RangeError` unless the value is a known way of joining rooms. */
export function assertConnection(value: string): void {
  if (!CONNECTIONS.includes(value)) {
    throw new RangeError(
      `connection must be one of ${CONNECTIONS.join(', ')}, got ${value}`,
    );
  }
}
