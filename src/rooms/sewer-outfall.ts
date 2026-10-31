import type { Point } from '../core/point';

/** An outfall of `digSewers`: an end of the trunk at the border of the map, and the way out beside it. */
export interface SewerOutfall {
  /** The border tile at the end of the walkway beside the trunk's water, reserved `Openable`. It stays wall until `openExits` with `at: 'outfalls'` opens it. */
  position: Point;
  /** Index into `mouths` of the end of the trunk it lies beside. */
  mouth: number;
}
