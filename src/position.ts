import type { Anchor } from './anchor';
import type { Point } from './point';
import type { Rotation } from './rotation';

/** An acceptable target for a room template. */
export interface Position {
  /** The map point that `anchor` of the placed room lands on. */
  coords: Point;
  /** Which point of the placed room's bounding box lands on `coords`. The anchor does not rotate with the template. */
  anchor: Anchor;
  /** Rotations allowed here. Defaults to the template's `rotate`; otherwise only rotations in both lists are used. */
  rotations?: Rotation[];
}
