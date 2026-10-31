import type { Point } from '../core/point';
import type { CatacombSide } from './catacomb-side';

/** A burial niche of a catacomb of `digCatacombs`: a short dead end of `Floor`, one tile wide, off the wall of a gallery or of a burial chamber. */
export interface CatacombNiche {
  /** Its tiles, from its mouth, the tile next to the gallery or the chamber, to its back. */
  tiles: Point[];
  /** The side of its gallery the niche is on, `'top'` or `'bottom'` of a horizontal one, `'left'` or `'right'` of a vertical one, or the side of its chamber. */
  side: CatacombSide;
  /** The index in `segments` of the segment it opens onto, or of the segment of its chamber. */
  segment: number;
  /** The index in `chambers` of the chamber it opens onto. Absent for a niche off a gallery. */
  chamber?: number;
}
