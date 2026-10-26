/**
 * Grows the marked tiles of a map by `radius` tiles in every direction,
 * diagonals included. `mask` holds one byte per tile, row by row, 1 where a
 * tile is marked. Returns a new mask of the same shape.
 */
export function dilateMask(
  mask: Uint8Array,
  mapWidth: number,
  mapHeight: number,
  radius: number,
): Uint8Array {
  const across = new Uint8Array(mask.length);
  for (let y = 0; y < mapHeight; ++y) {
    for (let x = 0; x < mapWidth; ++x) {
      if (mask[y * mapWidth + x] !== 1) {
        continue;
      }
      for (
        let nx = Math.max(0, x - radius);
        nx <= Math.min(mapWidth - 1, x + radius);
        ++nx
      ) {
        across[y * mapWidth + nx] = 1;
      }
    }
  }
  const grown = new Uint8Array(mask.length);
  for (let y = 0; y < mapHeight; ++y) {
    for (let x = 0; x < mapWidth; ++x) {
      if (across[y * mapWidth + x] !== 1) {
        continue;
      }
      for (
        let ny = Math.max(0, y - radius);
        ny <= Math.min(mapHeight - 1, y + radius);
        ++ny
      ) {
        grown[ny * mapWidth + x] = 1;
      }
    }
  }
  return grown;
}
