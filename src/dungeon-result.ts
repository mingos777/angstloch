import type { Exit } from './exit';
import type { Grid } from './grid';
import type { Room } from './room';

export interface DungeonResult {
  /** The generated map. */
  grid: Grid;
  /** The rooms, in the order they were placed. `rooms.length` is the room count. */
  rooms: Room[];
  /** Every exit of every room, whether it has a door or not. Doors alone are the exits with `door` set. */
  exits: Exit[];
  /** Share of the map covered by room floors, from 0 to 1. */
  fill: number;
}
