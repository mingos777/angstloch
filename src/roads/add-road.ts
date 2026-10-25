import { growCenterline } from './grow-centerline';
import { joinTiles } from './join-tiles';
import type { Road } from './road';
import type { RoadMap } from './road-map';
import type { RoadSpec } from './road-spec';
import { stampRoadBrush } from './stamp-road-brush';

/**
 * Lays a road on the road map and returns it. Wherever its centerline runs
 * into the centerline of a road that is there already, it makes a junction.
 * Where the two share a stretch of tiles, that is one junction, at the first
 * of them.
 */
export function addRoad(map: RoadMap, spec: RoadSpec): Road {
  const { mapWidth, mapHeight, windiness, noise, roads } = map;
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

  let touching = false;
  for (const tile of points) {
    stampRoadBrush(
      map.covered,
      mapWidth,
      mapHeight,
      tile.x,
      tile.y,
      spec.width,
    );
    const at = tile.y * mapWidth + tile.x;
    const owner = map.owner[at] ?? -1;
    const shared = owner !== -1 && owner !== index;
    if (shared && !touching) {
      map.junctions.push({ x: tile.x, y: tile.y });
    }
    touching = shared;
    if (owner === -1) {
      map.owner[at] = index;
    }
  }

  const road: Road = { kind: spec.kind, width: spec.width, points };
  roads.push(road);
  return road;
}
