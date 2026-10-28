import type { Room } from '../rooms/room';
import type { RoomShape } from '../rooms/room-shape';

/** The extras that `scatterRooms` and `partitionRooms` use and add. */
export interface PlacedRooms {
  rooms: Room[];
  roomShapes: RoomShape[];
}
