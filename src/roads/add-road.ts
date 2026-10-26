import { growCenterline } from './grow-centerline';
import { joinTiles } from './join-tiles';
import type { Road } from './road';
import type { RoadMap } from './road-map';
import type { RoadSpec } from './road-spec';
import { stampRoad } from './stamp-road';

/**
 * Lays a road on the road map and returns it. Wherever its centerline runs
 * into the centerline of a road that is there already, it makes a junction.
 * Where the two share a stretch of tiles, that is one junction, at the first
 * of them.
 */
export function addRoad(map: RoadMap, spec: RoadSpec): Road {
  const { mapWidth, mapHeight, noise, roads } = map;
  const windiness = spec.windiness ?? map.windiness;
  const index = roads.length;
  const grow = (direction: 1 | -1) =>
    growCenterline({
      mapWidth,
      mapHeight,
      origin: spec.origin,
      angle: spec.angle,
      windiness,
      noise,
      direction,
      // a different row of the noise for every road, so that they bend differently
      lane: 0.5 + index * 7.31,
      maxLength: spec.maxLength,
    });
  const backwards = spec.directions.includes(-1) ? grow(-1).reverse() : [];
  const forwards = spec.directions.includes(1) ? grow(1) : [];
  const points = joinTiles([...backwards, spec.origin, ...forwards]);

  return stampRoad(map, spec.kind, spec.width, points);
}
