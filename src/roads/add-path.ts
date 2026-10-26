import { growPinnedLine } from './grow-pinned-line';
import { joinTiles } from './join-tiles';
import type { PathSpec } from './path-spec';
import type { Road } from './road';
import type { RoadMap } from './road-map';
import { stampRoad } from './stamp-road';

/**
 * Lays a winding path from one point to another on the road map and returns
 * it. Unlike `addRoad`, which grows a road from one end, both ends of a path
 * are fixed, so it can join a road to a place, or end a road in one. The
 * path makes junctions with the roads it meets, as a road does.
 */
export function addPath(map: RoadMap, spec: PathSpec): Road {
  const { mapWidth, mapHeight, noise, roads } = map;
  const points = joinTiles(
    growPinnedLine({
      mapWidth,
      mapHeight,
      from: spec.from,
      to: spec.to,
      windiness: spec.windiness ?? map.windiness,
      noise,
      // a different row of the noise for every road, so that they bend differently
      lane: 0.5 + roads.length * 7.31,
    }),
  );
  return stampRoad(map, spec.kind, spec.width, points);
}
