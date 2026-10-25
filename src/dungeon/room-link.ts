import type { Room } from '../rooms/room';

/** A pair of rooms that a corridor could join. */
export interface RoomLink {
  a: Room;
  b: Room;
  /** The squared distance between the centers of the rooms. */
  distance: number;
}
