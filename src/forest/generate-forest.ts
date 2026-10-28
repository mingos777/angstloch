import { Tile } from '../core/tile';
import type { Point } from '../core/point';
import { emptyMap } from '../pipeline/empty-map';
import { pipeline } from '../pipeline/pipeline';
import type { Road } from '../roads/road';
import { createForestSteps } from './create-forest-steps';
import type { ForestOptions } from './forest-options';
import type { ForestResult } from './forest-result';
import type { ForestTemplate } from './forest-template';
import type { PlacedClearing } from './placed-clearing';

/**
 * Generates a forest, a ready-made composition of steps: noise decides where
 * the trees grow (`plantTrees`), then come the streams, the roads, the
 * clearings, the templates, the paths to clearings and the footbridges, as
 * far as their options are given. Each step clears the trees from its own
 * verge. The map is built again, up to 3 times in all, when a step throws,
 * which is what happens to a template that finds no place. For other
 * compositions, run the steps with `pipeline`.
 */
export function generateForest(options: ForestOptions): ForestResult {
  const { width, height, random } = options;
  const run = pipeline(
    emptyMap({ width, height, tile: Tile.Grass }),
    createForestSteps(options),
    { random },
  );
  // a step that was left out added nothing
  const extras: Partial<{
    roads: Road[];
    junctions: Point[];
    exits: Point[];
    streams: Road[];
    bridges: Point[];
    clearings: PlacedClearing[];
    templates: ForestTemplate[];
  }> = run as unknown as object;
  return {
    grid: run.grid,
    roads: extras.roads ?? [],
    junctions: extras.junctions ?? [],
    exits: extras.exits ?? [],
    streams: extras.streams ?? [],
    bridges: extras.bridges ?? [],
    clearings: extras.clearings ?? [],
    templates: extras.templates ?? [],
    attempts: run.attempts,
    failures: run.failures,
  };
}
