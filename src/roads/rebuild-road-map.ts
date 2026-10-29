import type { Random } from '../core/random';
import { createRoadMap } from './create-road-map';
import type { Road } from './road';
import type { RoadMap } from './road-map';
import { stampRoad } from './stamp-road';

/**
 * Works out the road map of the `roads` that a step reported: a new map with
 * every road stamped again in order, brush and the stretch past the border
 * included, so that `covered`, `owner` and `junctions` are those of the map
 * the roads were laid on. The map's noise is new, made from `random`, so
 * paths that are added to it wind differently than the roads before them.
 * Steps that need distances to roads, the ends of branches, or a place to lay
 * a path start from it.
 */
export function rebuildRoadMap(
  roads: readonly Road[],
  mapWidth: number,
  mapHeight: number,
  random: Random,
  windiness?: number,
): RoadMap {
  const map = createRoadMap(mapWidth, mapHeight, random, windiness);
  for (const { kind, width, points } of roads) {
    stampRoad(map, kind, width, points);
  }
  return map;
}
