import { brushOffsets } from './brush-offsets';

/**
 * Marks the tiles of a road of the given width around a centerline tile.
 * Narrow roads are squares, and wider ones have rounded corners so that a
 * road is about as wide in every direction. Tiles off the map are skipped.
 */
export function stampRoadBrush(
  covered: Uint8Array,
  mapWidth: number,
  mapHeight: number,
  x: number,
  y: number,
  width: number,
): void {
  for (const offset of brushOffsets(width)) {
    const tileX = x + offset.x;
    const tileY = y + offset.y;
    if (tileX >= 0 && tileY >= 0 && tileX < mapWidth && tileY < mapHeight) {
      covered[tileY * mapWidth + tileX] = 1;
    }
  }
}
