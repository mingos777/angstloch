import type { Point } from '../core/point';

const STEPS = [
  [1, 0],
  [0, 1],
  [-1, 0],
  [0, -1],
  [1, 1],
  [1, -1],
  [-1, 1],
  [-1, -1],
] as const;

/**
 * Finds a shortest path of tiles from one tile to another that never steps
 * on a blocked tile, except that the end tile may be one. It measures the
 * way as the crow flies would on a grid, a diagonal step counting about 1.41,
 * so the path keeps near the straight line instead of running along a row
 * and then a column. A diagonal step is taken only where both tiles beside
 * it are free, and is laid as two steps along edges, so every tile of the
 * path is next to the one before it along an edge, both ends included.
 * `blocked` holds one byte per tile, row by row, 1 where a tile is blocked.
 * Returns `undefined` when there is no path.
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
  const free = (x: number, y: number) =>
    x >= 0 &&
    y >= 0 &&
    x < mapWidth &&
    y < mapHeight &&
    (blocked[y * mapWidth + x] !== 1 || y * mapWidth + x === goal);
  const guess = (at: number) => {
    const dx = Math.abs((at % mapWidth) - to.x);
    const dy = Math.abs(Math.floor(at / mapWidth) - to.y);
    return Math.max(dx, dy) + (Math.SQRT2 - 1) * Math.min(dx, dy);
  };

  const cost = new Float64Array(blocked.length).fill(Infinity);
  const came = new Int32Array(blocked.length).fill(-1);
  const done = new Uint8Array(blocked.length);
  cost[start] = 0;
  came[start] = start;
  // a binary heap of tiles, by their cost so far and the guess of the rest
  const heap: { at: number; rank: number }[] = [
    { at: start, rank: guess(start) },
  ];
  const push = (item: { at: number; rank: number }) => {
    heap.push(item);
    for (let index = heap.length - 1; index > 0;) {
      const parent = (index - 1) >> 1;
      if ((heap[parent]?.rank ?? 0) <= item.rank) {
        break;
      }
      heap[index] = heap[parent] as { at: number; rank: number };
      heap[parent] = item;
      index = parent;
    }
  };
  const pop = () => {
    const top = heap[0];
    const last = heap.pop();
    if (heap.length > 0 && last) {
      heap[0] = last;
      for (let index = 0; ;) {
        const left = 2 * index + 1;
        const right = left + 1;
        let least = index;
        if ((heap[left]?.rank ?? Infinity) < (heap[least]?.rank ?? Infinity)) {
          least = left;
        }
        if ((heap[right]?.rank ?? Infinity) < (heap[least]?.rank ?? Infinity)) {
          least = right;
        }
        if (least === index) {
          break;
        }
        const swap = heap[least] as { at: number; rank: number };
        heap[least] = heap[index] as { at: number; rank: number };
        heap[index] = swap;
        index = least;
      }
    }
    return top;
  };

  for (let item = pop(); item && !done[goal]; item = pop()) {
    const { at } = item;
    if (done[at]) {
      continue;
    }
    done[at] = 1;
    const x = at % mapWidth;
    const y = Math.floor(at / mapWidth);
    for (const [dx, dy] of STEPS) {
      const nx = x + dx;
      const ny = y + dy;
      // a diagonal step never cuts the corner of a blocked tile
      if (
        !free(nx, ny) ||
        (dx !== 0 && dy !== 0 && (!free(x + dx, y) || !free(x, y + dy)))
      ) {
        continue;
      }
      const next = ny * mapWidth + nx;
      const through = (cost[at] ?? 0) + (dx !== 0 && dy !== 0 ? Math.SQRT2 : 1);
      if (through < (cost[next] ?? Infinity)) {
        cost[next] = through;
        came[next] = at;
        push({ at: next, rank: through + guess(next) });
      }
    }
  }
  if (came[goal] === -1) {
    return undefined;
  }
  const corners: Point[] = [];
  for (let at = goal; ; at = came[at] as number) {
    corners.push({ x: at % mapWidth, y: Math.floor(at / mapWidth) });
    if (at === start) {
      break;
    }
  }
  corners.reverse();
  // every diagonal step as a step along a row and one along a column
  const path: Point[] = [];
  for (const tile of corners) {
    const last = path[path.length - 1];
    if (last && last.x !== tile.x && last.y !== tile.y) {
      path.push(
        free(tile.x, last.y)
          ? { x: tile.x, y: last.y }
          : { x: last.x, y: tile.y },
      );
    }
    path.push(tile);
  }
  return path;
}
