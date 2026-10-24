import type { Point } from './point';

/**
 * A place where a room opens onto the rest of the map: a gap in the room's
 * wall. A door is only built there when `door` is set; otherwise the gap is a
 * plain opening.
 */
export interface Exit {
  /** The wall tile of the gap. It is `Tile.Door` when `door` is set and `Tile.Floor` otherwise. */
  position: Point;
  /** Ids of the rooms the exit belongs to: one, or two when a single door joins rooms that face each other across one wall. */
  rooms: number[];
  /** Whether a door was placed here. */
  door: boolean;
}
