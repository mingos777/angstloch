import type { Point } from '../core/point';
import { Tile } from '../core/tile';
import { emptyMap } from '../pipeline/empty-map';
import { pipeline } from '../pipeline/pipeline';
import type { Exit } from '../rooms/exit';
import type { Room } from '../rooms/room';
import { createMazeSteps } from './create-maze-steps';
import type { MazeOptions } from './maze-options';
import type { MazeResult } from './maze-result';

/**
 * Generates a maze, a ready-made composition of steps on a map of rock:
 * `placeMazeRooms` places the rooms and templates when `rooms` is given,
 * `digMaze` carves the maze round them with the recursive backtracker,
 * `openMazeRooms` opens the rooms onto it, and `openExits` carves the exits on
 * the border when `exits` is given. Corridors run along odd coordinates, so
 * odd map dimensions leave a single wall frame. The map is built again, up to
 * 3 times in all, when a step throws, which is what happens to a template that
 * finds no place, covers the start or cannot be joined. For other
 * compositions, a maze in part of a map among them, run the steps with
 * `pipeline`.
 */
export function generateMaze(options: MazeOptions): MazeResult {
  const { width, height, random } = options;
  const run = pipeline(
    emptyMap({ width, height, tile: Tile.Wall }),
    createMazeSteps(options),
    { random },
  );
  // a step that was left out added nothing; digMaze on the whole map always
  // reports its start
  const extras: Partial<{
    start: Point;
    exits: Point[];
    rooms: Room[];
    roomExits: Exit[];
  }> = run as unknown as object;
  return {
    grid: run.grid,
    start: extras.start ?? { x: 1, y: 1 },
    exits: extras.exits ?? [],
    rooms: extras.rooms ?? [],
    roomExits: extras.roomExits ?? [],
    attempts: run.attempts,
    failures: run.failures,
  };
}
