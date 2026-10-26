import type { Random } from '../core/random';
import { assertRoadOptions } from './assert-road-options';
import { collectLaidRoads } from './collect-laid-roads';
import { createRoadMap } from './create-road-map';
import type { LaidRoads } from './laid-roads';
import { layRoadNetwork } from './lay-road-network';
import type { RoadOptions } from './road-options';

/**
 * Lays the roads of a map of the given size. The main road runs from one
 * border to the opposite one through a point near the middle of the map.
 * Crossings and then branches are attached to the roads that are there.
 */
export function layRoads(
  mapWidth: number,
  mapHeight: number,
  random: Random,
  options: RoadOptions,
): LaidRoads {
  assertRoadOptions(options);
  const map = createRoadMap(mapWidth, mapHeight, random, options.windiness);
  layRoadNetwork(map, random, options);
  return collectLaidRoads(map);
}
