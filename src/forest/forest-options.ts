import type { BaseOptions } from '../core/base-options';
import type { Tile } from '../core/tile';
import type { NoiseFunction } from '../noise/noise-function';
import type { DistanceMetric } from '../roads/distance-metric';
import type { RoomTemplate } from '../rooms/templates/room-template';
import type { RoadOptions } from '../roads/road-options';
import type { StreamOptions } from '../streams/stream-options';
import type { ClearingSpec } from './clearing-spec';

export interface ForestOptions extends BaseOptions {
  /** Size in tiles of a feature of the density noise along the x axis, before rotation. Larger values make broader woods and glades. Defaults to 40. */
  scaleX?: number;
  /** Size in tiles of a feature of the density noise along the y axis, before rotation. Defaults to 40. */
  scaleY?: number;
  /** Clockwise rotation of the density noise in degrees, which makes stretched woods run diagonally. Defaults to 0. */
  rotation?: number;
  /** Number of layers of noise of the built-in noise, each finer than the one before. With the default of 1 there is a single layer, and `persistence` and `lacunarity` have no effect. Defaults to 1. */
  octaves?: number;
  /** How much each layer of the built-in noise counts against the one before it, from 0 to 1. Only matters with more than one octave. Defaults to 0.2. */
  persistence?: number;
  /** How much finer each layer of the built-in noise is than the one before it. Only matters with more than one octave. Defaults to 1, which puts every layer at the same zoom. */
  lacunarity?: number;
  /** The chance of a tree where the noise is at its lowest, from 0 to 1. The chance rises from here to `maxDensity` as the noise rises. Defaults to 0, which leaves the lowest parts bare. */
  minDensity?: number;
  /** The chance of a tree where the noise is at its highest, from 0 to 1. Defaults to 0.25, which makes the thickest woods a quarter full of trees. A value of 1 packs the thickest parts solid. */
  maxDensity?: number;
  /** Noise to use instead of the built-in simplex noise: a function of positions in noise units that returns a number from -1 to 1. The scales and the rotation apply to it, but `octaves`, `persistence` and `lacunarity` do not, so wrap it in `createFractalNoise` if you want layers. */
  noise?: NoiseFunction;
  /** The tile for ground without a tree. Defaults to `Tile.Grass`. */
  groundTile?: Tile;
  /** The tile for a tree. Defaults to `Tile.Tree`. */
  treeTile?: Tile;
  /** Lays roads through the forest, with no trees on them: a main road, and if asked for, crossings and branches. Defaults to no roads. */
  roads?: RoadOptions;
  /** The tile for a road. Defaults to `Tile.Road`. */
  roadTile?: Tile;
  /** Lays a stream through the forest, before the roads: shallow water on its banks, deep water in the middle when it is wide enough, and no trees in the water. A road that crosses it is laid over it as a bridge. Defaults to no streams. */
  streams?: StreamOptions;
  /** The tile for the shallow water of a stream. Defaults to `Tile.ShallowWater`. */
  shallowTile?: Tile;
  /** The tile for the deep water of a stream. Defaults to `Tile.DeepWater`. */
  deepTile?: Tile;
  /** The tile for a bridge, where a road crosses water. Defaults to `Tile.Bridge`. */
  bridgeTile?: Tile;
  /** How many tiles beside a road have no trees, a whole number of at least 0. Tiles count in any direction, so a clearance of 1 keeps trees off all eight neighbors of a road tile, diagonals included. Defaults to 0, where the trees grow right up to the road. */
  clearance?: number;
  /** How many tiles beside the water of a stream have no trees, a whole number of at least 0, counted like `clearance`. Defaults to 0, where trees grow right at the water's edge. */
  bankClearance?: number;
  /** How many tiles the trees take to thicken from none to their full density beyond the `bankClearance`, a whole number of at least 0, as for `falloff`. Defaults to 0. */
  bankFalloff?: number;
  /** How many tiles the trees take to thicken from none to their full density, beyond the `clearance` of a road and beyond the edge of a clearing, a whole number of at least 0. The chance of a tree grows in equal steps: with a falloff of 3 the first tile past the clearance has a quarter of its chance, the next half, the next three quarters, and the one after that all of it. Defaults to 0, where the trees are at full density right past the clearance. */
  falloff?: number;
  /** How the distance to a road is measured, for both `clearance` and `falloff`: `'chebyshev'` counts a diagonal step as one tile and makes square verges, `'manhattan'` counts only orthogonal steps and makes diamonds, and `'euclidean'` measures the straight line between tile centers, so a diagonal step is about 1.41 tiles, and makes round verges. Defaults to `'chebyshev'`. */
  distance?: DistanceMetric;
  /** Clearings to make: glades with ragged edges, free of trees, with the `falloff` thinning the trees beyond them. Each has a center of its own or is placed at random. Defaults to none. */
  clearings?: ClearingSpec[];
  /** How many tiles beyond their radii the clearings that are placed at random keep from each other, a whole number of at least 0. Clearings with a center of their own are not moved. Defaults to 0, where the plain ovals of two clearings may touch. */
  clearingSpacing?: number;
  /** Prefabricated [`RoomTemplate`]s to place: a ruin, a camp, an arena. A template that has `clearing: true` is centered on a free clearing of `clearings`, and any other goes to a random spot. Its `Floor` and `Wall` cells force their tiles, over trees and grass but never over a road or water, and its `Unused` cells leave the map as it is. A road or path never runs through a template: a path to the clearing stops at its edge. Exit, door and optional exit cells are bad input and throw a `RangeError`. A template that finds no place gets a new forest, up to three in all, and then throws a `TemplatePlacementError`. Defaults to none. */
  templates?: RoomTemplate[];
}
