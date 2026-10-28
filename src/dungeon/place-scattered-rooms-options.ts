import type { RoomPlacementOptions } from './room-placement-options';

/** Options of `placeScatteredRooms`. */
export interface PlaceScatteredRoomsOptions extends RoomPlacementOptions {
  /** How evenly rooms are spread, from 0 to 1: several candidate rooms are tried at once and the one farthest from the other rooms is kept, one candidate at 0 and ten at 1. Defaults to 0. */
  spacingUniformity?: number;
}
