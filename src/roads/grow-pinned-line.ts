import type { Point } from '../core/point';
import type { NoiseFunction } from '../noise/noise-function';

/** Tiles along the line between one bend to the next, as for roads. */
const WAVELENGTH = 30;
/** The farthest in tiles that a line with a windiness of 1 strays from its straight line. */
const MAX_OFFSET = 12;
/** A short line strays at most this share of its length, so that it never loops about. */
const MAX_SHARE = 0.25;

export interface PinnedLineOptions {
  mapWidth: number;
  mapHeight: number;
  /** Where the line starts, in tile units, where tile `(i, j)` covers `[i, i + 1)`. */
  from: Point;
  /** Where the line ends, in the same units. */
  to: Point;
  windiness: number;
  /** Decides the bends. Positions along the line make it wind. */
  noise: NoiseFunction;
  /** Which of the bends of `noise` this line follows, so that every line gets a different pattern of bends. */
  lane: number;
}

/**
 * Grows a winding line that passes through both of its ends. The noise pushes
 * the line sideways, and the push fades to nothing at the two ends, so the
 * line always starts at `from` and ends at `to`, which a road that is grown
 * from one end cannot promise. Returns points about a tile apart, `from`
 * first and `to` last, clamped to the map.
 */
export function growPinnedLine(options: PinnedLineOptions): Point[] {
  const { mapWidth, mapHeight, from, to, windiness, noise, lane } = options;
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const length = Math.hypot(dx, dy);
  const steps = Math.max(1, Math.ceil(length));
  const reach = windiness * Math.min(MAX_OFFSET, MAX_SHARE * length);
  const points: Point[] = [];
  for (let step = 0; step <= steps; ++step) {
    const along = step / steps;
    const sideways =
      length === 0
        ? 0
        : reach *
          Math.sin(Math.PI * along) *
          noise((along * length) / WAVELENGTH, lane);
    const x = from.x + dx * along - (dy / (length || 1)) * sideways;
    const y = from.y + dy * along + (dx / (length || 1)) * sideways;
    points.push({
      x: Math.min(Math.max(x, 0), mapWidth - 1e-6),
      y: Math.min(Math.max(y, 0), mapHeight - 1e-6),
    });
  }
  return points;
}
