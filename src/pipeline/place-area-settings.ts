import type { Area } from '../core/area';

/** How a box is placed, besides its size and its window: see `placeAreas`. */
export interface PlaceAreaSettings {
  /** Odd sizes and even coordinates. */
  lattice?: boolean;
  /** A spot need only be clear of the boxes taken before. */
  overlap?: boolean;
  /** Turns spots down by what they hold; asked only about boxes that are clear. */
  accepts?: (box: Area) => boolean;
}
