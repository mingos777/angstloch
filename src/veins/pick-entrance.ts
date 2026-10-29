import { pickRandom } from '../core/pick-random';
import type { Point } from '../core/point';
import type { Random } from '../core/random';

/** How many tiles deep the side of a hall that faces the other one is. */
export const ENTRANCE_BAND = 3;
/** How many tiles are tried for an entrance, the one furthest from the entrances already there winning. */
export const ENTRANCE_CANDIDATES = 10;

/**
 * Picks the tile where a vein leaves a hall, from the tiles of its boundary.
 * With `towards`, only the side that faces it counts: the band of tiles that
 * lie furthest in the direction from the middle of the hall, `from`, to
 * `towards`, measured along that line. Without it, the whole boundary does.
 * Several tiles are picked at random, and the one furthest from the entrances
 * already `used` on the hall wins, so that veins do not leave side by side.
 */
export function pickEntrance(
  random: Random,
  boundary: readonly Point[],
  from: Point,
  towards: Point | undefined,
  used: readonly Point[],
): Point {
  let candidates = boundary;
  const dx = towards ? towards.x - from.x : 0;
  const dy = towards ? towards.y - from.y : 0;
  if (dx !== 0 || dy !== 0) {
    const length = Math.hypot(dx, dy);
    const reach = (tile: Point) =>
      ((tile.x - from.x) * dx + (tile.y - from.y) * dy) / length;
    const furthest = Math.max(...boundary.map(reach));
    candidates = boundary.filter(
      (tile) => reach(tile) >= furthest - ENTRANCE_BAND,
    );
  }
  let best = pickRandom(random, candidates);
  let bestGap = gapTo(best, used);
  for (let n = 1; n < ENTRANCE_CANDIDATES; ++n) {
    const tile = pickRandom(random, candidates);
    const gap = gapTo(tile, used);
    if (gap > bestGap) {
      best = tile;
      bestGap = gap;
    }
  }
  return best;
}

/** The distance from a tile to the nearest of the others, or infinity when there are none. */
function gapTo(tile: Point, others: readonly Point[]): number {
  return Math.min(
    ...others.map((other) => Math.hypot(tile.x - other.x, tile.y - other.y)),
  );
}
