import type { AnyStep } from '../pipeline/pipeline-chain';
import { layFootbridges } from '../streams/lay-footbridges';
import { layRoads } from '../streams/lay-roads';
import { layStreams } from '../streams/lay-streams';
import { layClearingPaths } from './lay-clearing-paths';
import type { ForestStepOptions } from './forest-options';
import { placeClearings } from './place-clearings';
import { placeTemplates } from './place-templates';
import { plantTrees } from './plant-trees';

/**
 * The steps of a forest, in the order that they need: `plantTrees`, then
 * `layStreams`, `layRoads`, `placeClearings`, `placeTemplates`,
 * `layClearingPaths` (when a clearing asks for a path) and `layFootbridges`
 * (when there are streams, unless `footbridges` is `false`). A step whose
 * options are missing is left out, and each step takes only its own options.
 * Every option is checked here, and a bad one throws a `RangeError`. The
 * playground and the checker run these steps with a `trace` of their own.
 */
export function createForestSteps(options: ForestStepOptions): AnyStep[] {
  const { trees, streams, roads, clearings, templates, paths, footbridges } =
    options;
  const steps: AnyStep[] = [plantTrees(trees)];
  if (streams) {
    steps.push(layStreams(streams));
  }
  if (roads) {
    steps.push(layRoads(roads));
  }
  if (clearings) {
    steps.push(placeClearings(clearings));
  }
  if (templates) {
    steps.push(placeTemplates(templates));
  }
  if (clearings?.clearings.some(({ path }) => path)) {
    steps.push(layClearingPaths(paths));
  }
  if (streams && footbridges !== false) {
    steps.push(layFootbridges(footbridges));
  }
  return steps;
}
