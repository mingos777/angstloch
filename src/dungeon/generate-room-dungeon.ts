import { createRoomDungeonSteps } from './create-room-dungeon-steps';
import type { RoomDungeonOptions } from './room-dungeon-options';
import type { RoomDungeonResult } from './room-dungeon-result';
import { runDungeonSteps } from './run-dungeon-steps';

/**
 * Generates a dungeon room-first, a ready-made composition of steps on a map
 * of rock: `placeScatteredRooms` (or `placePartitionedRooms`, with `partition`) places the
 * templated rooms and then the ordinary rooms round them, and
 * `digCorridors` joins them all with corridors and gives the exits doors.
 * The map is built again, up to 3 times in all, when a step throws, which is
 * what happens to a template that finds no place or cannot be joined. For
 * other compositions, rooms of both kinds or rooms in part of a map among
 * them, run the steps with `pipeline`.
 */
export function generateRoomDungeon(
  options: RoomDungeonOptions,
): RoomDungeonResult {
  return runDungeonSteps(options, createRoomDungeonSteps(options));
}
