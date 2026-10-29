import type { BaseOptions } from '../core/base-options';
import type { LayFootbridgesOptions } from '../streams/lay-footbridges-options';
import type { LayRoadsOptions } from '../streams/lay-roads-options';
import type { LayStreamsOptions } from '../streams/lay-streams-options';
import type { LayClearingPathsOptions } from './lay-clearing-paths-options';
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
  /** A stream or river through the forest, laid before the roads, with the verge kept clear of trees beside its water. See `layStreams`. Defaults to no streams. */
  streams?: LayStreamsOptions;
  /** Roads through the forest, with the verge kept clear of trees beside them, and how they cross the streams. See `layRoads`. Defaults to no roads. */
  roads?: LayRoadsOptions;
  /** Clearings: glades with ragged edges, free of trees. The paths that clearings ask for are laid after the templates, by `paths`. See `placeClearings`. Defaults to none. */
  clearings?: PlaceClearingsOptions;
  /** Templates to place: a ruin, a camp, an arena. See `placeTemplates`. Defaults to none. */
  templates?: PlaceTemplatesOptions;
  /** The paths that clearings ask for: their tiles and verge. See `layClearingPaths`. They take nothing from `roads`, so for paths that look like the roads give the same `roadTile`, `bridgeTile`, `clearance`, `falloff` and `distance` here. Only used when a clearing asks for a path, and then with the defaults of that step unless given. */
  paths?: LayClearingPathsOptions;
  /** Footbridges across the streams, to join the land that the water cuts apart, and the least number of bridges. See `layFootbridges`. Only used when there are `streams`, and then on by default. `false` leaves the footbridges out. */
  footbridges?: LayFootbridgesOptions | false;
}

/** The options of `generateForest`. */
export interface ForestOptions extends BaseOptions, ForestStepOptions {}
