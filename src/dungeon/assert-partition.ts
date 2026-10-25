import type { RoomPartition } from '../rooms/room-dungeon-options';

const PARTITIONS: readonly string[] = [
  'scatter',
  'bsp',
] satisfies RoomPartition[];

/** Throws a `RangeError` unless the value is a known partitioning method. */
export function assertPartition(value: string): void {
  if (!PARTITIONS.includes(value)) {
    throw new RangeError(
      `partition must be one of ${PARTITIONS.join(', ')}, got ${value}`,
    );
  }
}
