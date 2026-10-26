import type { Point } from '../core/point';
import { traceTiles } from '../roads/trace-tiles';

const PASSES = 60;

/**
 * Pulls a path of tiles taut like a rope, so that the stairs of a shortest
 * path along edges become gentle bends, without moving it onto a blocked
 * tile. Both ends stay where they are. `blocked` holds one byte per tile,
 * row by row, 1 where a tile is blocked. Every tile of the result is next to
 * the one before it along an edge.
 */
export function smoothPath(
  path: Point[],
  blocked: Uint8Array,
  mapWidth: number,
  mapHeight: number,
): Point[] {
  const points = path.map(({ x, y }) => ({ x, y }));
  for (let pass = 0; pass < PASSES; ++pass) {
    for (let at = 1; at < points.length - 1; ++at) {
      const before = points[at - 1] as Point;
      const after = points[at + 1] as Point;
      const x = (before.x + after.x) / 2;
      const y = (before.y + after.y) / 2;
      const tx = Math.round(x);
      const ty = Math.round(y);
      if (
        tx >= 0 &&
        ty >= 0 &&
        tx < mapWidth &&
        ty < mapHeight &&
        blocked[ty * mapWidth + tx] !== 1
      ) {
        points[at] = { x, y };
      }
    }
  }
  const tiles: Point[] = [];
  for (const { x, y } of points) {
    const tile = { x: Math.round(x), y: Math.round(y) };
    const last = tiles[tiles.length - 1];
    if (!last) {
      tiles.push(tile);
    } else if (last.x !== tile.x || last.y !== tile.y) {
      tiles.push(...traceTiles(last, tile).slice(1));
    }
  }
  return tiles;
}
