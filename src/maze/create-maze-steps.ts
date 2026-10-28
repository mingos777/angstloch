import { addExits } from '../exits/add-exits';
import type { AnyStep } from '../pipeline/pipeline-chain';
import { carveMaze } from './carve-maze';
import type { MazeStepOptions } from './maze-options';
import { openMazeRooms } from './open-maze-rooms';
import { placeMazeRooms } from './place-maze-rooms';

/**
 * The steps of a maze, in order: `placeMazeRooms` when `rooms` is given, then
 * `carveMaze`, then `openMazeRooms` when there are rooms, and `addExits` when
 * `exits` is given. Each step takes only its own options. Every option is
 * checked here, and a bad one throws a `RangeError`.
 */
export function createMazeSteps(options: MazeStepOptions): AnyStep[] {
  const { maze, rooms, openings, exits } = options;
  const steps: AnyStep[] = [];
  if (rooms) {
    steps.push(placeMazeRooms(rooms));
  }
  steps.push(carveMaze(maze));
  if (rooms) {
    steps.push(openMazeRooms(openings));
  }
  if (exits) {
    steps.push(addExits(exits));
  }
  return steps;
}
