import type { Road } from './road';
import type { RoadKind } from './road-kind';
import type { RoadMap } from './road-map';
import { stampRoadBrush } from './stamp-road-brush';

/**
 * Lays a road along the given centerline tiles on the road map and returns
 * it. Wherever its centerline runs into the centerline of a road that is
 * there already, it makes a junction. Where the two share a stretch of tiles,
 * that is one junction, at the first of them.
 */
export function stampRoad(
  map: RoadMap,
  kind: RoadKind,
  width: number,
  points: Road['points'],
): Road {
  const { mapWidth, mapHeight, roads } = map;
  const index = roads.length;
  let touching = false;
  for (const tile of points) {
    stampRoadBrush(map.covered, mapWidth, mapHeight, tile.x, tile.y, width);
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

  const road: Road = { kind, width, points };
  roads.push(road);
  return road;
}
