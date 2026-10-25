/**
 * Marks the tiles that a road keeps free of trees: the tiles of the roads
 * themselves and every tile within `clearance` tiles of one of them, in any
 * direction, so a diagonal step counts as one tile and a clearance of 1 takes
 * in all eight neighbors. Returns one byte per tile, row by row: 1 for a tile
 * that is cleared, 0 for the rest.
 */
export function roadClearing(
  covered: Uint8Array,
  mapWidth: number,
  mapHeight: number,
  clearance: number,
): Uint8Array {
  const cleared = new Uint8Array(mapWidth * mapHeight);
  for (let y = 0; y < mapHeight; ++y) {
    for (let x = 0; x < mapWidth; ++x) {
      if (!covered[y * mapWidth + x]) {
        continue;
      }
      const top = Math.max(0, y - clearance);
      const bottom = Math.min(mapHeight - 1, y + clearance);
      const left = Math.max(0, x - clearance);
      const right = Math.min(mapWidth - 1, x + clearance);
      for (let row = top; row <= bottom; ++row) {
        cleared.fill(1, row * mapWidth + left, row * mapWidth + right + 1);
      }
    }
  }
  return cleared;
}
