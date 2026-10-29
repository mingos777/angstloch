import type { Exit } from './exit';
import type { Room } from './room';
import type { RoomGroup } from './room-group';
import type { RoomShape } from './room-shape';

/** The extras that `placeCellBlocks` uses and adds. */
export interface PlacedCellBlocks {
  rooms: Room[];
  roomShapes: RoomShape[];
  roomExits: Exit[];
  roomGroups: RoomGroup[];
}
