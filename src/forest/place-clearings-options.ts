import type { Verge } from '../roads/verge';
import type { ClearingSpec } from './clearing-spec';

/**
 * Options of `placeClearings`: the clearings, how far random ones keep apart,
 * and the verge beyond them. A clearing is bare inside its ragged edge, so a
 * `clearance` would mean nothing, and only `falloff` and `distance` of the verge
 * are taken.
 */
export interface PlaceClearingsOptions extends Pick<
  Verge,
  'falloff' | 'distance'
> {
  /** Clearings to make: glades with ragged edges, free of trees. Each has a center of its own or is placed at random. A clearing that finds no room is left out. */
  clearings: ClearingSpec[];
  /** How many tiles beyond their radii the clearings that are placed at random keep from each other, a whole number of at least 0. Clearings with a center of their own are not moved. Defaults to 0, where the plain ovals of two clearings may touch. */
  spacing?: number;
}
