import type { Point } from '../core/point';
import type { Random } from '../core/random';
import { randomInt } from '../core/random-int';
import type { RoadMap } from './road-map';

/** Tiles at either end of a road where nothing is attached. */
const END_MARGIN = 6;
/** The least distance in tiles between an attached road and a junction that is there already. */
const JUNCTION_GAP = 8;
const ATTEMPTS = 30;

export interface AttachPoint {
  /** The tile of a road's centerline to attach to. */
  tile: Point;
  /** The direction of the road there, in radians clockwise from east, looking along its centerline. */
  heading: number;
}

/**
 * Picks a place on one of the roads to attach another road to: a tile away
 * from the ends of the road and from the junctions, so roads do not pile up.
 * Longer roads are more likely to be chosen. Returns `undefined` when there
 * is no such place, which is the case on a small map.
 */
export function findAttachPoint(
  map: RoadMap,
  random: Random,
): AttachPoint | undefined {
  const spots = map.roads.map((road) =>
    Math.max(0, road.points.length - 2 * END_MARGIN),
  );
  const total = spots.reduce((sum, count) => sum + count, 0);
  for (let attempt = 0; total > 0 && attempt < ATTEMPTS; ++attempt) {
    let pick = randomInt(random, 0, total - 1);
    const roadIndex = spots.findIndex((count) => {
      pick -= count;
      return pick < 0;
    });
    const road = map.roads[roadIndex];
    const spot = pick + (spots[roadIndex] ?? 0) + END_MARGIN;
    const tile = road?.points[spot];
    const before = road?.points[Math.max(0, spot - 3)];
    const after = road?.points[Math.min(road.points.length - 1, spot + 3)];
    if (
      !tile ||
      !before ||
      !after ||
      map.junctions.some(
        (j) =>
          Math.max(Math.abs(j.x - tile.x), Math.abs(j.y - tile.y)) <
          JUNCTION_GAP,
      )
    ) {
      continue;
    }
    return {
      tile,
      heading: Math.atan2(after.y - before.y, after.x - before.x),
    };
  }
  return undefined;
}
