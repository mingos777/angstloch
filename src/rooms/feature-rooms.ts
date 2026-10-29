import type { Room } from './room';
import type { RoomGroup } from './room-group';
import type { RoomShape } from './room-shape';

/** The extras that the steps of halls and caverns use and add. */
export interface FeatureRooms {
  rooms: Room[];
  roomShapes: RoomShape[];
  roomGroups: RoomGroup[];
}
