import type { Point } from '../core/point';
import { addPath } from '../roads/add-path';
import type { RoadMap } from '../roads/road-map';
import type { ClearingPath } from './clearing-path';

/**
 * Finds where a path to `to` starts: the tile of a road's centerline that is
 * nearest to it, or the nearest tile on the border of the map when there are
 * no roads.
 */
function findStart(map: RoadMap, to: Point): Point {
  const { mapWidth, mapHeight } = map;
  const candidates: Point[] =
    map.roads.length > 0
      ? map.roads.flatMap((road) => road.points)
      : [
          { x: 0, y: to.y },
          { x: mapWidth - 1, y: to.y },
          { x: to.x, y: 0 },
          { x: to.x, y: mapHeight - 1 },
        ];
  let nearest = candidates[0] as Point;
  for (const tile of candidates) {
    if (
      Math.hypot(tile.x - to.x, tile.y - to.y) <
      Math.hypot(nearest.x - to.x, nearest.y - to.y)
    ) {
      nearest = tile;
    }
  }
  return nearest;
}

/**
 * Lays the paths that lead to clearings, each from the nearest road, or from
 * the nearest border of the map when there are no roads, to the center of its
 * clearing. A clearing that a road runs through the center of needs no path
 * and gets none.
 */
export function layClearingPaths(
  map: RoadMap,
  paths: readonly ClearingPath[],
): void {
  for (const { to, width, windiness } of paths) {
    const from = findStart(map, to);
    if (from.x === to.x && from.y === to.y) {
      continue;
    }
    addPath(map, {
      kind: 'branch',
      width,
      windiness,
      from: { x: from.x + 0.5, y: from.y + 0.5 },
      to: { x: to.x + 0.5, y: to.y + 0.5 },
    });
  }
}
