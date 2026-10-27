import { buildRoomDungeon } from './build-room-dungeon';
import type { DungeonResult } from './dungeon-result';
import { retryPlacement } from '../rooms/templates/retry-placement';
import type { RoomDungeonOptions } from '../rooms/room-dungeon-options';

/**
 * Generates a dungeon room-first: templated rooms are placed first, then the
 * other rooms around them without overlapping, then everything is joined by
 * corridors, and exits get doors.
 */
export function generateRoomDungeon(
  options: RoomDungeonOptions,
): DungeonResult {
  return retryPlacement(() => buildRoomDungeon(options));
}
