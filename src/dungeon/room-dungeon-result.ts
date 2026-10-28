import type { PipelineFailure } from '../pipeline/pipeline-failure';
import type { DungeonResult } from './dungeon-result';

/** The result of `generateRoomDungeon` and `generateDigDungeon`. */
export interface RoomDungeonResult extends DungeonResult {
  /** How many times the dungeon was built, 1 or more: a map is built again when a step throws, up to 3 in all. */
  attempts: number;
  /** One entry per failed attempt, also when a later attempt succeeded. */
  failures: PipelineFailure[];
}
