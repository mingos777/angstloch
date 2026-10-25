import type { CaveRegion } from './cave-region';
import type { Point } from '../core/point';

/** Summarizes the tiles of a region; there must be at least one. */
export function describeCaveRegion(tiles: readonly Point[]): CaveRegion {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  let sumX = 0;
  let sumY = 0;
  for (const { x, y } of tiles) {
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x);
    maxY = Math.max(maxY, y);
    sumX += x;
    sumY += y;
  }
  const meanX = sumX / tiles.length;
  const meanY = sumY / tiles.length;
  let center = tiles[0] as Point;
  let nearest = Infinity;
  for (const tile of tiles) {
    const distance = (tile.x - meanX) ** 2 + (tile.y - meanY) ** 2;
    if (distance < nearest) {
      nearest = distance;
      center = tile;
    }
  }
  return {
    size: tiles.length,
    center: { x: center.x, y: center.y },
    bounds: {
      x: minX,
      y: minY,
      width: maxX - minX + 1,
      height: maxY - minY + 1,
    },
  };
}
