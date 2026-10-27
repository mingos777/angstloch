import type { Point } from '../core/point';

/** How many tiles each way a turn is measured over. */
const SPAN = 4;
/** How many tiles each side every tile is averaged with first, which irons out the stairs of a path along edges. */
const SMOOTH = 2;

/**
 * Measures the sharpest turn along a path of tiles, in degrees: the change
 * of heading between the `SPAN` tiles before a tile and the `SPAN` tiles
 * after it, once every tile is averaged with `SMOOTH` tiles each side. A
 * road as grown with a windiness up to 0.3 turns about 40 degrees at most,
 * and a turn of more than 45 reads as a corner.
 */
export function sharpestTurn(tiles: readonly Point[]): number {
  const points = tiles.map((_, at) => {
    const near = tiles.slice(Math.max(0, at - SMOOTH), at + SMOOTH + 1);
    return {
      x: near.reduce((sum, { x }) => sum + x, 0) / near.length,
      y: near.reduce((sum, { y }) => sum + y, 0) / near.length,
    };
  });
  let sharpest = 0;
  for (let at = SPAN; at + SPAN < points.length; ++at) {
    const behind = points[at - SPAN];
    const here = points[at];
    const ahead = points[at + SPAN];
    if (!behind || !here || !ahead) {
      continue;
    }
    const before = Math.atan2(here.y - behind.y, here.x - behind.x);
    const after = Math.atan2(ahead.y - here.y, ahead.x - here.x);
    const turn = (Math.abs(before - after) * 180) / Math.PI;
    sharpest = Math.max(sharpest, turn > 180 ? 360 - turn : turn);
  }
  return sharpest;
}
