import type { Point } from '../core/point';

/** How many tiles past the border a road goes on. */
const PAST = 2;
/** How many tiles back from its end tell which way a road leaves the map. */
const SPAN = 6;
/** The most tiles a road moves along the border for each tile it moves out: a road that leaves at a shallower angle runs along the border, and goes out at this angle instead. */
const MAX_DRIFT = 4;

/**
 * Lists the tiles that carry a centerline on past the border of the map, so
 * that the brush stamped along them makes the border cut the road cleanly,
 * instead of ending it in a square. Each end of the centerline that lies on
 * the border goes on the way the road leaves the map, until it is `PAST`
 * tiles out, a tile at a time along the axis it moves fastest along. Every
 * tile is off the map, so a road that leaves at a shallow angle tapers along
 * the border. A road that leaves along the border goes straight out, and one
 * that leaves at a very shallow angle at the angle of `MAX_DRIFT`. Ends
 * inside the map get none.
 */
export function extendPastBorder(
  points: readonly Point[],
  mapWidth: number,
  mapHeight: number,
): Point[] {
  const beyond = (end: Point | undefined, back: Point | undefined) => {
    if (!end || !back) {
      return [];
    }
    // the ways out across the borders that the end lies on
    const outs: Point[] = [
      ...(end.x === 0 ? [{ x: -1, y: 0 }] : []),
      ...(end.x === mapWidth - 1 ? [{ x: 1, y: 0 }] : []),
      ...(end.y === 0 ? [{ x: 0, y: -1 }] : []),
      ...(end.y === mapHeight - 1 ? [{ x: 0, y: 1 }] : []),
    ];
    const dx = end.x - back.x;
    const dy = end.y - back.y;
    // the border that the road heads out across most squarely
    const out = outs.reduce<Point | undefined>(
      (best, way) =>
        !best || way.x * dx + way.y * dy > best.x * dx + best.y * dy
          ? way
          : best,
      undefined,
    );
    if (!out) {
      return [];
    }
    const outward = out.x * dx + out.y * dy;
    // how far the road moves along the border for each tile it moves out
    const drift =
      outward > 0
        ? Math.max(
            -MAX_DRIFT,
            Math.min(MAX_DRIFT, (out.x * dy - out.y * dx) / outward),
          )
        : 0;
    // steps of a tile along the faster of the two ways the road moves
    const steps = Math.max(1, Math.ceil(Math.abs(drift)));
    return Array.from({ length: PAST * steps }, (_, index) => {
      const away = (index + 1) / steps;
      // never back on the map, even where the line is still on the last row
      const across = Math.max(1, Math.round(away));
      const along = Math.round(away * drift);
      return {
        x: end.x + across * out.x - along * out.y,
        y: end.y + across * out.y + along * out.x,
      };
    });
  };
  const last = points.length - 1;
  return [
    ...beyond(points[0], points[Math.min(SPAN, last)]),
    ...(last > 0 ? beyond(points[last], points[Math.max(0, last - SPAN)]) : []),
  ];
}
