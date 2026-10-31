import type { Exit } from '../rooms/exit';
import type { Room } from '../rooms/room';
import type { RoomGroup } from '../rooms/room-group';
import type { RoomShape } from '../rooms/room-shape';

/** The extras that `digCatacombs` uses and adds. */
export interface DugCatacombs {
  rooms: Room[];
  roomShapes: RoomShape[];
  roomExits: Exit[];
  roomGroups: RoomGroup[];
}
