import type { Point } from '../core/point';

/**
 * Finds the bridges: the groups of tiles, joined along edges, that are both
 * road and water. Each is reported at the tile of the group that is nearest
 * to its middle. Both arrays hold one byte per tile, row by row.
 */
export function findBridges(
  water: Uint8Array,
  road: Uint8Array,
  mapWidth: number,
  mapHeight: number,
): Point[] {
  const bridge = (at: number) => water[at] === 1 && road[at] === 1;
  const seen = new Uint8Array(water.length);
  const bridges: Point[] = [];
  for (let start = 0; start < water.length; ++start) {
    if (seen[start] || !bridge(start)) {
      continue;
    }
    const group: Point[] = [];
    const pending = [start];
    seen[start] = 1;
    for (let at = pending.pop(); at !== undefined; at = pending.pop()) {
      const x = at % mapWidth;
      const y = Math.floor(at / mapWidth);
      group.push({ x, y });
      for (const [nx, ny] of [
        [x - 1, y],
        [x + 1, y],
        [x, y - 1],
        [x, y + 1],
      ] as const) {
        const next = ny * mapWidth + nx;
        if (
          nx >= 0 &&
          ny >= 0 &&
          nx < mapWidth &&
          ny < mapHeight &&
          !seen[next] &&
          bridge(next)
        ) {
          seen[next] = 1;
          pending.push(next);
        }
      }
    }
    const middleX = group.reduce((sum, { x }) => sum + x, 0) / group.length;
    const middleY = group.reduce((sum, { y }) => sum + y, 0) / group.length;
    let nearest = group[0] as Point;
    for (const tile of group) {
      if (
        Math.hypot(tile.x - middleX, tile.y - middleY) <
        Math.hypot(nearest.x - middleX, nearest.y - middleY)
      ) {
        nearest = tile;
      }
    }
    bridges.push(nearest);
  }
  return bridges;
}
