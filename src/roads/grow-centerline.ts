import type { Point } from '../core/point';
import type { NoiseFunction } from '../noise/noise-function';

/** Tiles along the road between one bend to the next. */
const WAVELENGTH = 30;
/** The farthest in tiles that a road with a windiness of 1 strays from its straight line. */
const MAX_OFFSET = 12;

export interface CenterlineOptions {
  mapWidth: number;
  mapHeight: number;
  /** Where the road passes, in tile units, where tile `(i, j)` covers `[i, i + 1)`. */
  origin: Point;
  /** Direction in radians, clockwise from east. */
  angle: number;
  windiness: number;
  /** Decides the bends. Positions along the road make it wind. */
  noise: NoiseFunction;
  /** 1 grows the road forwards from the origin, -1 backwards. */
  direction: 1 | -1;
  /** Which of the bends of `noise` this road follows: the noise runs along this row, so every road gets a different pattern of bends. */
  lane: number;
  /** Stops after this many tiles, if the road has not left the map by then. The road does not have to leave the map. */
  maxLength?: number;
}

/**
 * Grows a winding line from a point in one direction, a tile at a time, until
 * it leaves the map. The line is pushed sideways by the noise, but passes
 * through the origin. Returns the points after the origin, in order. The last
 * point is on the border of the map.
 */
export function growCenterline(options: CenterlineOptions): Point[] {
  const {
    mapWidth,
    mapHeight,
    origin,
    angle,
    windiness,
    noise,
    direction,
    lane,
    maxLength,
  } = options;
  const forwardX = Math.cos(angle);
  const forwardY = Math.sin(angle);
  const bend = (along: number) => noise(along / WAVELENGTH, lane);
  const atOrigin = bend(0);
  const points: Point[] = [];
  const limit = maxLength ?? 2 * (mapWidth + mapHeight);
  for (let step = 1; step <= limit; ++step) {
    const along = direction * step;
    const sideways = windiness * MAX_OFFSET * (bend(along) - atOrigin);
    const x = origin.x + forwardX * along - forwardY * sideways;
    const y = origin.y + forwardY * along + forwardX * sideways;
    if (x < 0 || x >= mapWidth || y < 0 || y >= mapHeight) {
      points.push({
        x: Math.min(Math.max(x, 0), mapWidth - 1e-6),
        y: Math.min(Math.max(y, 0), mapHeight - 1e-6),
      });
      break;
    }
    points.push({ x, y });
  }
  return points;
}
