import type { Point } from '../core/point';
import type { LaidRoads } from './laid-roads';
import type { RoadMap } from './road-map';

/** Sums up a road map: its roads, its junctions, the tiles they cover and the places where roads reach the border. */
export function collectLaidRoads(map: RoadMap): LaidRoads {
  const { mapWidth, mapHeight } = map;
  const exits: Point[] = [];
  const onBorder = ({ x, y }: Point) =>
    x === 0 || y === 0 || x === mapWidth - 1 || y === mapHeight - 1;
  for (const { points } of map.roads) {
    for (const end of [points[0], points[points.length - 1]]) {
      if (
        end &&
        onBorder(end) &&
        !exits.some(({ x, y }) => x === end.x && y === end.y)
      ) {
        exits.push({ x: end.x, y: end.y });
      }
    }
  }

  return {
    roads: map.roads,
    junctions: map.junctions,
    exits,
    covered: map.covered,
  };
}
