import type { Room } from '../rooms/room';
import type { RoomShape } from '../rooms/room-shape';

/** The extras that `placeScatteredRooms` and `placePartitionedRooms` use and add. */
export interface PlacedRooms {
  rooms: Room[];
  roomShapes: RoomShape[];
}
