import type { MapStep } from '../pipeline/map-step';
import { scatterRoomPlan } from '../rooms/scatter-room-plan';
import type { PlacedRooms } from './placed-rooms';
import { roomPlacementStep } from './room-placement-step';
import type { ScatterRoomsOptions } from './scatter-rooms-options';

/**
 * A step that scatters the rooms of a dungeon over the map, or over each of
 * its areas, by trying random rooms one after another, for corridors to join
 * them later: the templates first, then the ordinary rooms, which keep
 * `roomSpacing` from each other, from the templates and from every tile that
 * is not free, so they can join a map that earlier steps built. Placing stops
 * at `roomCount.max`, at the `fill` once `roomCount.min` is reached, or when
 * 100 rooms in a row do not fit. A template that cannot be placed fails the
 * attempt, which `pipeline` retries.
 *
 * The rooms are carved but not opened. Each gets a shape in `roomShapes` and
 * reserves its footprint from it (see `reserveRoomShape`). It uses `rooms` and
 * `roomShapes` from the steps before it, and adds them again with its own
 * appended, the ids following on. The map has to start as wall, which
 * `pipeline` checks before the first attempt. Throws a `RangeError` at once
 * for a bad option or template.
 */
export function scatterRooms(
  options: ScatterRoomsOptions = {},
): MapStep<Partial<PlacedRooms>, PlacedRooms> {
  return roomPlacementStep('scatterRooms', options, scatterRoomPlan);
}
