import type { Point } from '../core/point';
import { traceTiles } from './trace-tiles';

/** Joins points into one path of tiles that each touch the one before along an edge. */
export function joinTiles(points: Point[]): Point[] {
  const tiles: Point[] = [];
  for (const { x, y } of points) {
    const tile = { x: Math.floor(x), y: Math.floor(y) };
    const last = tiles[tiles.length - 1];
    if (!last) {
      tiles.push(tile);
    } else if (last.x !== tile.x || last.y !== tile.y) {
      tiles.push(...traceTiles(last, tile).slice(1));
    }
  }
  return tiles;
}
