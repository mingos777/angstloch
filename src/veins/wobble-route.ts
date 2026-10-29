import type { Point } from '../core/point';
import type { NoiseFunction } from '../noise/noise-function';
import { joinTiles } from '../roads/join-tiles';

/** How many tiles on each side of a tile are averaged to smooth the steps of a route. */
const SMOOTHING = 3;
/** How many tiles at each end of a route are left as they are, fading in, so that the ends stay where they are. */
const FADE = 4;
/** Tiles along the route from one bend to the next. */
const WAVELENGTH = 20;
/** The farthest in tiles that a route with a windiness of 1 strays sideways. */
const MAX_OFFSET = 3;
/** The shares of the offset that are tried, in turn, where the full offset would hit something. */
const SHARES = [1, 0.5, 0.25];

/**
 * Gives a route that was found over free tiles a natural look: the steps of
 * its corners are smoothed out and noise pushes it sideways, the more so the
 * higher the windiness. Where a push would put it on a tile that `blocked`
 * marks with a 1, row by row, it is made smaller, down to nothing. The first
 * and last tile stay where they are. When the result still touches a blocked
 * tile, the route is returned as it was. Returns tiles that each touch the one
 * before along an edge.
 */
export function wobbleRoute(
  route: readonly Point[],
  width: number,
  height: number,
  blocked: Uint8Array,
  noise: NoiseFunction,
  windiness: number,
  lane: number,
): Point[] {
  const free = (x: number, y: number) =>
    x >= 0 && y >= 0 && x < width && y < height && blocked[y * width + x] !== 1;
  const last = route.length - 1;
  if (last < 2 * FADE || windiness === 0) {
    return [...route];
  }
  const centers = route.map(({ x, y }) => ({ x: x + 0.5, y: y + 0.5 }));
  const smooth = (index: number): Point => {
    let sumX = 0;
    let sumY = 0;
    let count = 0;
    for (let n = -SMOOTHING; n <= SMOOTHING; ++n) {
      const around = centers[Math.min(last, Math.max(0, index + n))];
      if (around) {
        sumX += around.x;
        sumY += around.y;
        ++count;
      }
    }
    return { x: sumX / count, y: sumY / count };
  };
  const points: Point[] = route.map((tile, index) => {
    const here = centers[index] ?? { x: tile.x + 0.5, y: tile.y + 0.5 };
    const fade = Math.min(1, index / FADE, (last - index) / FADE);
    if (fade === 0) {
      return here;
    }
    const before = smooth(index - 1);
    const after = smooth(index + 1);
    const length = Math.hypot(after.x - before.x, after.y - before.y) || 1;
    const smoothed = smooth(index);
    const push =
      fade * windiness * MAX_OFFSET * noise(index / WAVELENGTH, lane);
    for (const share of SHARES) {
      const x = smoothed.x - ((after.y - before.y) / length) * push * share;
      const y = smoothed.y + ((after.x - before.x) / length) * push * share;
      if (free(Math.floor(x), Math.floor(y))) {
        return { x, y };
      }
    }
    return free(Math.floor(smoothed.x), Math.floor(smoothed.y))
      ? smoothed
      : here;
  });
  const tiles = joinTiles(points);
  return tiles.every(({ x, y }) => free(x, y)) ? tiles : [...route];
}
