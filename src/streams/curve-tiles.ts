import type { Point } from '../core/point';
import { traceTiles } from '../roads/trace-tiles';

/**
 * Lays a smooth curve of tiles from one tile to another, leaving the first
 * in the direction `startAngle` and arriving at the second in the direction
 * `endAngle`, both in radians. Every tile is next to the one before it along
 * an edge. The curve may bulge past the two tiles, and may leave the map.
 */
export function curveTiles(
  from: Point,
  to: Point,
  startAngle: number,
  endAngle: number,
): Point[] {
  const chord = Math.hypot(to.x - from.x, to.y - from.y);
  const steps = Math.max(2, Math.ceil(chord * 2));
  const tiles: Point[] = [{ x: from.x, y: from.y }];
  let last = from;
  for (let step = 1; step <= steps; ++step) {
    const t = step / steps;
    const start = 2 * t ** 3 - 3 * t ** 2 + 1;
    const startTangent = t ** 3 - 2 * t ** 2 + t;
    const end = -2 * t ** 3 + 3 * t ** 2;
    const endTangent = t ** 3 - t ** 2;
    const tile = {
      x: Math.round(
        start * from.x +
          startTangent * chord * Math.cos(startAngle) +
          end * to.x +
          endTangent * chord * Math.cos(endAngle),
      ),
      y: Math.round(
        start * from.y +
          startTangent * chord * Math.sin(startAngle) +
          end * to.y +
          endTangent * chord * Math.sin(endAngle),
      ),
    };
    if (tile.x !== last.x || tile.y !== last.y) {
      tiles.push(...traceTiles(last, tile).slice(1));
      last = tile;
    }
  }
  if (last.x !== to.x || last.y !== to.y) {
    tiles.push(...traceTiles(last, to).slice(1));
  }
  return tiles;
}
