import type { Point } from '../core/point';
import type { Room } from './room';

/** A way through a room's wall to a maze cell. */
export interface MazeOpening {
  room: Room;
  /** The wall tile to open. */
  wall: Point;
  /** The tile of the room it leads from. */
  inside: Point;
  /** The maze cell it leads to. */
  outside: Point;
  /** Whether the opening gets a door. Decided by `doorChance` when absent. */
  door?: boolean;
  /** Whether the opening must be made, as with the `Exit` and `Door` cells of a template. */
  fixed?: boolean;
}
