import type { BaseOptions } from '../core/base-options';
import type { AddFootbridgesOptions } from '../streams/add-footbridges-options';
import type { AddRoadsOptions } from '../streams/add-roads-options';
import type { AddStreamsOptions } from '../streams/add-streams-options';
import type { PlaceClearingsOptions } from './place-clearings-options';
import type { PlaceTemplatesOptions } from './place-templates-options';
import type { PlantTreesOptions } from './plant-trees-options';

/**
 * The options of a forest that are not its size or its randomness: one key
 * per step of the forest, each holding the options of that step.
 */
export interface ForestStepOptions {
  /** The trees: the noise and the density of the woods, and the tile to plant. See `plantTrees`. Defaults to the defaults of that step. */
  trees?: PlantTreesOptions;
  /** A stream or river through the forest, laid before the roads, with the verge kept clear of trees beside its water. See `addStreams`. Defaults to no streams. */
  streams?: AddStreamsOptions;
  /** Roads through the forest, with the verge kept clear of trees beside them, and how they cross the streams. See `addRoads`. Defaults to no roads. */
  roads?: AddRoadsOptions;
  /** Clearings: glades with ragged edges, free of trees. The paths that clearings ask for are laid after the templates, and take their tiles and verge from `roads`. See `placeClearings`. Defaults to none. */
  clearings?: PlaceClearingsOptions;
  /** Templates to place: a ruin, a camp, an arena. See `placeTemplates`. Defaults to none. */
  templates?: PlaceTemplatesOptions;
  /** Footbridges across the streams, to join the land that the water cuts apart, and the least number of bridges. See `addFootbridges`. Only used when there are `streams`, and then on by default. `false` leaves the footbridges out. */
  footbridges?: AddFootbridgesOptions | false;
}

/** The options of `generateForest`. */
export interface ForestOptions extends BaseOptions, ForestStepOptions {}
