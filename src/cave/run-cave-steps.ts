import type { Point } from '../core/point';
import type { Random } from '../core/random';
import { Tile } from '../core/tile';
import { emptyMap } from '../pipeline/empty-map';
import { pipeline } from '../pipeline/pipeline';
import type { AnyStep } from '../pipeline/pipeline-chain';
import type { CaveResult } from './cave-result';
import { describeCaveRegion } from './describe-cave-region';
import { findCaveRegions } from './find-cave-regions';

/** The size and randomness of a cave, which both cave presets share. */
interface CaveSize {
  width: number;
  height: number;
  random?: Random;
}

/**
 * Runs the steps of a cave preset on a map of wall and describes what they
 * made: the regions of the finished map, measured after the pipeline, and the
 * exits, empty when no step added them.
 */
export function runCaveSteps(
  { width, height, random }: CaveSize,
  steps: AnyStep[],
): CaveResult {
  const run = pipeline(emptyMap({ width, height, tile: Tile.Wall }), steps, {
    random,
  });
  // a step that was left out added nothing
  const extras: Partial<{ exits: Point[] }> = run as unknown as object;
  return {
    grid: run.grid,
    regions: findCaveRegions(run.grid).map(describeCaveRegion),
    exits: extras.exits ?? [],
    attempts: run.attempts,
    failures: run.failures,
  };
}
