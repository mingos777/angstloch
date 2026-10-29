import type { MapStep } from '../pipeline/map-step';
import { partitionRoomPlan } from '../rooms/partition-room-plan';
import type { PlacePartitionedRoomsOptions } from './place-partitioned-rooms-options';
import type { PlacedRooms } from './placed-rooms';
import { roomPlacementStep } from './room-placement-step';

/**
 * A step that places the rooms of a dungeon by binary space partitioning, for
 * corridors to join them later: the map, or each of its areas, is cut in two
 * again and again, and every part that results holds one room. The number of
 * parts is estimated from the `fill` and the typical room size and kept within
 * `roomCount`. The templates go first, and an ordinary room that comes within
 * `roomSpacing` of a template or of a tile that is not free is left out, so
 * the rooms can join a map that earlier steps built. A template that cannot
 * be placed fails the attempt, which `pipeline` retries.
 *
 * The rooms are carved but not opened. Each gets a shape in `roomShapes` and
 * reserves its footprint from it (see `reserveRoomShape`). It uses `rooms` and
 * `roomShapes` from the steps before it, and adds them again with its own
 * appended, the ids following on. The map has to start as wall, which
 * `pipeline` checks before the first attempt. Throws a `RangeError` at once
 * for a bad option or template.
 */
export function placePartitionedRooms(
  options: PlacePartitionedRoomsOptions = {},
): MapStep<Partial<PlacedRooms>, PlacedRooms> {
  return roomPlacementStep('placePartitionedRooms', options, partitionRoomPlan);
}
