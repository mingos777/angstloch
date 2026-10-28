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
 * `addClearingPaths` (when a clearing asks for a path, with the tiles and the
 * verge of `roads`) and `addFootbridges` (when there are streams, unless
 * `footbridges` is `false`). A step whose options are missing is left out.
 * Every option is checked here, and a bad one throws a `RangeError`. The
 * playground and the checker run these steps with a `trace` of their own.
 */
export function createForestSteps(options: ForestStepOptions): AnyStep[] {
  const { trees, streams, roads, clearings, templates, footbridges } = options;
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
    steps.push(
      addClearingPaths({
        roadTile: roads?.roadTile,
        bridgeTile: roads?.bridgeTile,
        clearance: roads?.clearance,
        falloff: roads?.falloff,
        distance: roads?.distance,
      }),
    );
  }
  if (streams && footbridges !== false) {
    steps.push(addFootbridges(footbridges));
  }
  return steps;
}
