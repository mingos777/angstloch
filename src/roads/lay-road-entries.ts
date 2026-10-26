import type { Point } from '../core/point';
import type { Random } from '../core/random';
import { addPath } from './add-path';
import { addRoad } from './add-road';
import type { RoadEntry } from './road-entry';
import type { RoadMap } from './road-map';

const radians = (degrees: number) => (degrees * Math.PI) / 180;

/** A start for a road: a point in tile units and, when the road is attached, the direction of the road there. */
interface Start {
  point: Point;
  heading?: number;
}

const clamp = (value: number, max: number) => Math.min(Math.max(value, 0), max);

/** The point on the map nearest to the given one, so that a road is never aimed off the map. */
function clampPoint(map: RoadMap, { x, y }: Point): Point {
  return {
    x: clamp(x, map.mapWidth - 1e-6),
    y: clamp(y, map.mapHeight - 1e-6),
  };
}

/** Where an entry starts: the tile of its parent that `at` points to, or its origin, or a random point near the middle. */
function findStart(map: RoadMap, random: Random, entry: RoadEntry): Start {
  const parent =
    entry.parent === undefined ? undefined : map.roads[entry.parent];
  const points = parent?.points ?? [];
  if (points.length > 0) {
    const spot = Math.round((entry.at ?? 0.5) * (points.length - 1));
    const tile = points[spot];
    const before = points[Math.max(0, spot - 3)];
    const after = points[Math.min(points.length - 1, spot + 3)];
    if (tile && before && after) {
      return {
        point: { x: tile.x + 0.5, y: tile.y + 0.5 },
        heading: Math.atan2(after.y - before.y, after.x - before.x),
      };
    }
  }
  return {
    point: clampPoint(
      map,
      entry.origin ?? {
        x: map.mapWidth * (0.25 + 0.5 * random()),
        y: map.mapHeight * (0.25 + 0.5 * random()),
      },
    ),
  };
}

/**
 * Lays the roads the caller asked for, one after another, on the road map.
 * The entries must be valid. An entry is laid as best it can be: points off
 * the map are moved onto it, and a road that runs out of map is cut short.
 */
export function layRoadEntries(
  map: RoadMap,
  random: Random,
  entries: readonly RoadEntry[],
): void {
  for (const entry of entries) {
    const kind = entry.kind ?? 'road';
    const width = entry.width ?? (kind === 'road' ? 3 : 1);
    const { windiness } = entry;
    const start = findStart(map, random, entry);

    if (entry.to) {
      addPath(map, {
        kind,
        width,
        from: start.point,
        to: clampPoint(map, entry.to),
        windiness,
      });
      continue;
    }

    const angle =
      entry.angle === undefined
        ? start.heading === undefined
          ? random() * Math.PI
          : start.heading + (random() < 0.5 ? 1 : -1) * (Math.PI / 2)
        : radians(entry.angle);
    addRoad(map, {
      kind,
      width,
      origin: start.point,
      angle,
      directions: kind === 'road' ? [-1, 1] : [1],
      maxLength: entry.length,
      windiness,
    });
  }
}
