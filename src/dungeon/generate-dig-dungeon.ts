import { createDigDungeonSteps } from './create-dig-dungeon-steps';
import type { DigDungeonOptions } from './dig-dungeon-options';
import type { RoomDungeonResult } from './room-dungeon-result';
import { runDungeonSteps } from './run-dungeon-steps';

/**
 * Generates a dungeon that grows from the middle, a ready-made composition of
 * steps on a map of rock: `placeClusteredRooms` places the templated rooms, the first
 * of them in the middle, and grows the ordinary rooms off them, or off a room
 * in the middle, each beyond a wall of one there is; `digCorridors` then
 * joins them all with corridors and gives the exits doors. The map is built
 * again, up to 3 times in all, when a step throws, which is what happens to a
 * template that finds no place or cannot be joined. For other compositions,
 * run the steps with `pipeline`.
 */
export function generateDigDungeon(
  options: DigDungeonOptions,
): RoomDungeonResult {
  return runDungeonSteps(options, createDigDungeonSteps(options));
}
