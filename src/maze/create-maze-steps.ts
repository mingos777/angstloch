import { openExits } from '../exits/open-exits';
import type { AnyStep } from '../pipeline/pipeline-chain';
import { digMaze } from './dig-maze';
import type { MazeStepOptions } from './maze-options';
import { openMazeRooms } from './open-maze-rooms';
import { placeMazeRooms } from './place-maze-rooms';

/**
 * The steps of a maze, in order: `placeMazeRooms` when `rooms` is given, then
 * `digMaze`, then `openMazeRooms` when there are rooms, and `openExits` when
 * `exits` is given. Each step takes only its own options. Every option is
 * checked here, and a bad one throws a `RangeError`.
 */
export function createMazeSteps(options: MazeStepOptions): AnyStep[] {
  const { maze, rooms, openings, exits } = options;
  const steps: AnyStep[] = [];
  if (rooms) {
    steps.push(placeMazeRooms(rooms));
  }
  steps.push(digMaze(maze));
  if (rooms) {
    steps.push(openMazeRooms(openings));
  }
  if (exits) {
    steps.push(openExits(exits));
  }
  return steps;
}
