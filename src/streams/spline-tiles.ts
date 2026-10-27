import type { Point } from '../core/point';
import { traceTiles } from '../roads/trace-tiles';

/**
 * Lays a smooth curve of tiles through the points, a Catmull-Rom spline,
 * from the first to the last. It leaves the first point heading `leaving`
 * and arrives at the last heading `arriving`, both in radians. Every tile
 * is next to the one before it along an edge.
 */
export function splineTiles(
  points: readonly Point[],
  leaving: number,
  arriving: number,
): Point[] {
  const first = points[0];
  const last = points[points.length - 1];
  if (!first || !last) {
    return [];
  }
  const reach = (one: Point, other: Point) =>
    Math.hypot(other.x - one.x, other.y - one.y);
  // a point before the first and one after the last, along the headings
  const before = {
    x: first.x - reach(first, points[1] ?? last) * Math.cos(leaving),
    y: first.y - reach(first, points[1] ?? last) * Math.sin(leaving),
  };
  const after = {
    x:
      last.x +
      reach(points[points.length - 2] ?? first, last) * Math.cos(arriving),
    y:
      last.y +
      reach(points[points.length - 2] ?? first, last) * Math.sin(arriving),
  };
  const controls = [before, ...points, after];
  const tiles: Point[] = [{ x: first.x, y: first.y }];
  for (let at = 1; at + 2 < controls.length; ++at) {
    const p0 = controls[at - 1] as Point;
    const p1 = controls[at] as Point;
    const p2 = controls[at + 1] as Point;
    const p3 = controls[at + 2] as Point;
    const steps = Math.max(2, Math.ceil(reach(p1, p2) * 2));
    for (let step = 1; step <= steps; ++step) {
      const t = step / steps;
      const blend = (a: number, b: number, c: number, d: number) =>
        0.5 *
        (2 * b +
          (c - a) * t +
          (2 * a - 5 * b + 4 * c - d) * t ** 2 +
          (3 * b - a - 3 * c + d) * t ** 3);
      const tile = {
        x: Math.round(blend(p0.x, p1.x, p2.x, p3.x)),
        y: Math.round(blend(p0.y, p1.y, p2.y, p3.y)),
      };
      const previous = tiles[tiles.length - 1] as Point;
      if (tile.x !== previous.x || tile.y !== previous.y) {
        tiles.push(...traceTiles(previous, tile).slice(1));
      }
    }
  }
  const end = tiles[tiles.length - 1] as Point;
  if (end.x !== last.x || end.y !== last.y) {
    tiles.push(...traceTiles(end, last).slice(1));
  }
  return tiles;
}
