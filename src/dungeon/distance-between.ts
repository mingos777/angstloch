import type { Room } from '../rooms/room';

/** The squared distance between the centers of two rooms, which orders pairs of rooms by how close they are. */
export function distanceBetween(a: Room, b: Room): number {
  return (
    (a.x + a.width / 2 - b.x - b.width / 2) ** 2 +
    (a.y + a.height / 2 - b.y - b.height / 2) ** 2
  );
}
