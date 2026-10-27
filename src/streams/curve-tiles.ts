import type { Point } from '../core/point';
import { traceTiles } from '../roads/trace-tiles';

/**
 * Lays a smooth curve of tiles from one tile to another, leaving the first
 * in the direction `startAngle` and arriving at the second in the direction
 * `endAngle`, both in radians. `sway`, if given, pushes the curve sideways
 * by that many tiles at each point, from 0 at `from` to 1 at `to`, to the
 * right of the way it runs; it should be 0 at both ends. Every tile is next
 * to the one before it along an edge. `tension` scales how far the curve
 * keeps to its two headings, 1 by default: less makes it turn sooner and
 * keep nearer the straight line, more makes it swing wider. The curve may
 * bulge past the two tiles, and may leave the map.
 */
export function curveTiles(
  from: Point,
  to: Point,
  startAngle: number,
  endAngle: number,
  sway?: (along: number) => number,
  tension = 1,
): Point[] {
  const distance = Math.hypot(to.x - from.x, to.y - from.y);
  const chord = distance * tension;
  const steps = Math.max(2, Math.ceil(distance * 2));
  const tiles: Point[] = [{ x: from.x, y: from.y }];
  let last = from;
  for (let step = 1; step <= steps; ++step) {
    const t = step / steps;
    const start = 2 * t ** 3 - 3 * t ** 2 + 1;
    const startTangent = t ** 3 - 2 * t ** 2 + t;
    const end = -2 * t ** 3 + 3 * t ** 2;
    const endTangent = t ** 3 - t ** 2;
    // the way the curve runs here, for the sideways push
    const speedX =
      (6 * t ** 2 - 6 * t) * from.x +
      (3 * t ** 2 - 4 * t + 1) * chord * Math.cos(startAngle) +
      (-6 * t ** 2 + 6 * t) * to.x +
      (3 * t ** 2 - 2 * t) * chord * Math.cos(endAngle);
    const speedY =
      (6 * t ** 2 - 6 * t) * from.y +
      (3 * t ** 2 - 4 * t + 1) * chord * Math.sin(startAngle) +
      (-6 * t ** 2 + 6 * t) * to.y +
      (3 * t ** 2 - 2 * t) * chord * Math.sin(endAngle);
    const speed = Math.hypot(speedX, speedY) || 1;
    const push = sway ? sway(t) : 0;
    const tile = {
      x: Math.round(
        start * from.x +
          startTangent * chord * Math.cos(startAngle) +
          end * to.x +
          endTangent * chord * Math.cos(endAngle) -
          (push * speedY) / speed,
      ),
      y: Math.round(
        start * from.y +
          startTangent * chord * Math.sin(startAngle) +
          end * to.y +
          endTangent * chord * Math.sin(endAngle) +
          (push * speedX) / speed,
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
