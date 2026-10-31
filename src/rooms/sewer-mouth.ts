import type { Point } from '../core/point';

/** An end of a canal of `digSewers`, where its water meets a wall, or runs into a cistern. */
export interface SewerMouth {
  /** The tile of water at the end of the canal's centerline, or the `Bridge` that carries the ledge of a cistern over it where the canal runs into one. */
  position: Point;
  /** The wall tile beyond `position` that the water meets. Absent at an outfall that pierces the border, where the water leaves the map, and where the canal runs into a cistern. */
  wall?: Point;
  /** Index into `canals` of the canal it ends. */
  canal: number;
}
