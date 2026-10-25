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
  const start = -Math.floor((width - 1) / 2);
  const middle = (width - 1) / 2;
  for (let j = 0; j < width; ++j) {
    for (let i = 0; i < width; ++i) {
      if (Math.hypot(i - middle, j - middle) > width / 2) {
        continue;
      }
      const tileX = x + start + i;
      const tileY = y + start + j;
      if (tileX >= 0 && tileY >= 0 && tileX < mapWidth && tileY < mapHeight) {
        covered[tileY * mapWidth + tileX] = 1;
      }
    }
  }
}
