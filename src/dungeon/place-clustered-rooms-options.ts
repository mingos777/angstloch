import type { Range } from '../core/range';
import type { RoomPlacementOptions } from './room-placement-options';

/** Options of `placeClusteredRooms`. */
export interface PlaceClusteredRoomsOptions extends RoomPlacementOptions {
  /** Tiles of corridor between the walls of a room and of the room it is built off, a `Range` of whole numbers of at least 0. 0 puts the new room against the wall, sharing it, which needs a `roomSpacing` of 1. A gap whose rooms would be closer than `roomSpacing` is left out of the range. With `lattice` placement gaps are rounded to an odd length. Defaults to `{ min: 1, max: 4 }`. */
  gap?: Range;
  /** Weight of the left and right walls, which new rooms are built beyond, against `verticalBias`. Only the ratio matters, so set both; a lone value against 0 means always. Defaults to 0. */
  horizontalBias?: number;
  /** Weight of the top and bottom walls against `horizontalBias`. Defaults to 0. */
  verticalBias?: number;
}
