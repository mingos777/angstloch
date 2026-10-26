import type { Point } from '../core/point';

const STEPS = [
  [1, 0],
  [0, 1],
  [-1, 0],
  [0, -1],
] as const;

/**
 * Finds a shortest path of tiles from one tile to another that never steps
 * on a blocked tile, except that the end tile may be one, moving along edges, both ends included. `blocked` holds
 * one byte per tile, row by row, 1 where a tile is blocked. Returns
 * `undefined` when there is no path.
 */
export function findLandPath(
  from: Point,
  to: Point,
  blocked: Uint8Array,
  mapWidth: number,
  mapHeight: number,
): Point[] | undefined {
  const start = from.y * mapWidth + from.x;
  const goal = to.y * mapWidth + to.x;
  const came = new Int32Array(blocked.length).fill(-1);
  came[start] = start;
  const queue = [start];
  for (let head = 0; head < queue.length && came[goal] === -1; ++head) {
    const at = queue[head] as number;
    const x = at % mapWidth;
    const y = Math.floor(at / mapWidth);
    for (const [dx, dy] of STEPS) {
      const nx = x + dx;
      const ny = y + dy;
      const next = ny * mapWidth + nx;
      if (
        nx >= 0 &&
        ny >= 0 &&
        nx < mapWidth &&
        ny < mapHeight &&
        came[next] === -1 &&
        (blocked[next] !== 1 || next === goal)
      ) {
        came[next] = at;
        queue.push(next);
      }
    }
  }
  if (came[goal] === -1) {
    return undefined;
  }
  const path: Point[] = [];
  for (let at = goal; ; at = came[at] as number) {
    path.push({ x: at % mapWidth, y: Math.floor(at / mapWidth) });
    if (at === start) {
      break;
    }
  }
  return path.reverse();
}
