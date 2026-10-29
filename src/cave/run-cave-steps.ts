import type { Point } from '../core/point';
import type { Random } from '../core/random';
import { Tile } from '../core/tile';
import { emptyMap } from '../pipeline/empty-map';
import { pipeline } from '../pipeline/pipeline';
import type { AnyStep } from '../pipeline/pipeline-chain';
import type { Exit } from '../rooms/exit';
import type { FeatureRooms } from '../rooms/feature-rooms';
import type { CaveResult } from './cave-result';

/** The size and randomness of a cave, which both cave presets share. */
interface CaveSize {
  width: number;
  height: number;
  random?: Random;
}

/**
 * Runs the steps of a cave preset on a map of wall and returns what they made:
 * the caverns, with their shapes, groups and the ways in, and the exits, each empty when no
 * step added it.
 */
export function runCaveSteps(
  { width, height, random }: CaveSize,
  steps: AnyStep[],
): CaveResult {
  const run = pipeline(emptyMap({ width, height, tile: Tile.Wall }), steps, {
    random,
  });
  // a step that was left out added nothing
  const extras: Partial<FeatureRooms & { roomExits: Exit[]; exits: Point[] }> =
    run as unknown as object;
  return {
    grid: run.grid,
    rooms: extras.rooms ?? [],
    roomShapes: extras.roomShapes ?? [],
    roomGroups: extras.roomGroups ?? [],
    roomExits: extras.roomExits ?? [],
    exits: extras.exits ?? [],
    attempts: run.attempts,
    failures: run.failures,
  };
}
