import type { Point } from '../core/point';
import type { CatacombSide } from '../rooms/catacomb-side';

/** The unit step out of a gallery or a chamber, into the rock on a side. */
export const OUTWARD: Readonly<Record<CatacombSide, Point>> = {
  top: { x: 0, y: -1 },
  right: { x: 1, y: 0 },
  bottom: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
};
