import type { Point } from '../core/point';
import { Tile } from '../core/tile';
import { emptyMap } from '../pipeline/empty-map';
import { pipeline } from '../pipeline/pipeline';
import type { Exit } from '../rooms/exit';
import type { Room } from '../rooms/room';
import type { RoomGroup } from '../rooms/room-group';
import type { RoomShape } from '../rooms/room-shape';
import { createMineSteps } from './create-mine-steps';
import type { MineOptions } from './mine-options';
import type { MinePassage } from '../veins/mine-passage';
import type { MineResult } from './mine-result';

/**
 * Generates a mine, a ready-made composition of steps on a map of rock: one
 * layout step digs the tunnels (`digFishbone`, or `digVeins`, `digPillarHalls`
 * or `digRings`), which are one connected piece closed in by a ring of wall;
 * then come the caverns and the tunnels that join them, the rooms and the
 * exits, as far as their options are given. The map is built again, up to 3
 * times in all, when a step throws, which is what happens to a template that
 * finds no place or cannot be joined, or a cavern that finds no free spot. For
 * other compositions, two layouts in one map among them, run the steps with
 * `pipeline`.
 */
export function generateMine(options: MineOptions): MineResult {
  const { width, height, random } = options;
  const run = pipeline(
    emptyMap({ width, height, tile: Tile.Wall }),
    createMineSteps(options),
    { random },
  );
  // a step that was left out added nothing
  const extras: Partial<{
    passages: MinePassage[];
    rooms: Room[];
    roomShapes: RoomShape[];
    roomGroups: RoomGroup[];
    roomExits: Exit[];
    exits: Point[];
  }> = run as unknown as object;
  return {
    grid: run.grid,
    passages: extras.passages ?? [],
    rooms: extras.rooms ?? [],
    roomShapes: extras.roomShapes ?? [],
    roomGroups: extras.roomGroups ?? [],
    roomExits: extras.roomExits ?? [],
    exits: extras.exits ?? [],
    attempts: run.attempts,
    failures: run.failures,
  };
}
