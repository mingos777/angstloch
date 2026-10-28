import type { AnyStep } from '../pipeline/pipeline-chain';
import { addFootbridges } from '../streams/add-footbridges';
import { addRoads } from '../streams/add-roads';
import { addStreams } from '../streams/add-streams';
import { addClearingPaths } from './add-clearing-paths';
import type { ForestStepOptions } from './forest-options';
import { placeClearings } from './place-clearings';
import { placeTemplates } from './place-templates';
import { plantTrees } from './plant-trees';

/**
 * The steps of a forest, in the order that they need: `plantTrees`, then
 * `addStreams`, `addRoads`, `placeClearings`, `placeTemplates`,
 * `addClearingPaths` (when a clearing asks for a path) and `addFootbridges`
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
    steps.push(addStreams(streams));
  }
  if (roads) {
    steps.push(addRoads(roads));
  }
  if (clearings) {
    steps.push(placeClearings(clearings));
  }
  if (templates) {
    steps.push(placeTemplates(templates));
  }
  if (clearings?.clearings.some(({ path }) => path)) {
    steps.push(addClearingPaths(paths));
  }
  if (streams && footbridges !== false) {
    steps.push(addFootbridges(footbridges));
  }
  return steps;
}
