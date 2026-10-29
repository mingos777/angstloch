import type { Point } from '../core/point';

/** How much a tile off the straight line between the ends adds to its cost, so that routes of equal length run straight and not in an L. */
const STRAIGHTNESS = 0.001;

/** A queue that hands out the entry with the lowest priority first. */
class PriorityQueue {
  private readonly priorities: number[] = [];
  private readonly items: number[] = [];

  get size(): number {
    return this.items.length;
  }

  push(item: number, priority: number): void {
    let at = this.items.length;
    this.items.push(item);
    this.priorities.push(priority);
    while (at > 0) {
      const parent = (at - 1) >> 1;
      if ((this.priorities[parent] ?? 0) <= priority) {
        break;
      }
      this.swap(at, parent);
      at = parent;
    }
  }

  pop(): number | undefined {
    const top = this.items[0];
    const lastItem = this.items.pop();
    const lastPriority = this.priorities.pop();
    if (this.items.length > 0 && lastItem !== undefined) {
      this.items[0] = lastItem;
      this.priorities[0] = lastPriority ?? 0;
      let at = 0;
      for (;;) {
        const left = 2 * at + 1;
        const right = left + 1;
        let smallest = at;
        if (
          left < this.items.length &&
          (this.priorities[left] ?? 0) < (this.priorities[smallest] ?? 0)
        ) {
          smallest = left;
        }
        if (
          right < this.items.length &&
          (this.priorities[right] ?? 0) < (this.priorities[smallest] ?? 0)
        ) {
          smallest = right;
        }
        if (smallest === at) {
          break;
        }
        this.swap(at, smallest);
        at = smallest;
      }
    }
    return top;
  }

  private swap(a: number, b: number): void {
    [this.items[a], this.items[b]] = [this.items[b] ?? 0, this.items[a] ?? 0];
    [this.priorities[a], this.priorities[b]] = [
      this.priorities[b] ?? 0,
      this.priorities[a] ?? 0,
    ];
  }
}

/**
 * Finds the shortest route over free tiles from one tile to another, both
 * included, stepping along edges only, never diagonally. `blocked` marks the
 * tiles that may not be used with a 1, row by row. Among routes of the same
 * length it takes one that runs close to the straight line between the ends.
 * A route of more than `maxSteps` steps does not count, and the search gives
 * up on it as soon as it is clear that it will be longer. Returns nothing when
 * there is no route, or when an end is blocked or off the map.
 */
export function findRockRoute(
  width: number,
  height: number,
  blocked: Uint8Array,
  from: Point,
  to: Point,
  maxSteps = Infinity,
): Point[] | undefined {
  const inside = (tile: Point) =>
    tile.x >= 0 && tile.y >= 0 && tile.x < width && tile.y < height;
  if (
    !inside(from) ||
    !inside(to) ||
    blocked[from.y * width + from.x] === 1 ||
    blocked[to.y * width + to.x] === 1 ||
    Math.abs(to.x - from.x) + Math.abs(to.y - from.y) > maxSteps
  ) {
    return undefined;
  }
  const start = from.y * width + from.x;
  const goal = to.y * width + to.x;
  const cost = new Float64Array(width * height).fill(Infinity);
  const cameFrom = new Int32Array(width * height).fill(-1);
  const done = new Uint8Array(width * height);
  const queue = new PriorityQueue();
  const lineX = to.x - from.x;
  const lineY = to.y - from.y;
  const priority = (index: number, steps: number) => {
    const x = index % width;
    const y = Math.floor(index / width);
    const toGoal = Math.abs(to.x - x) + Math.abs(to.y - y);
    const offLine = Math.abs((x - from.x) * lineY - (y - from.y) * lineX);
    return steps + toGoal + STRAIGHTNESS * offLine;
  };
  cost[start] = 0;
  queue.push(start, priority(start, 0));
  while (queue.size > 0) {
    const index = queue.pop();
    if (index === undefined || done[index] === 1) {
      continue;
    }
    done[index] = 1;
    if (index === goal) {
      break;
    }
    const x = index % width;
    const y = Math.floor(index / width);
    const steps = (cost[index] ?? 0) + 1;
    for (const [dx, dy] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ] as const) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= width || ny >= height) {
        continue;
      }
      const next = ny * width + nx;
      if (
        blocked[next] === 1 ||
        steps >= (cost[next] ?? Infinity) ||
        steps + Math.abs(to.x - nx) + Math.abs(to.y - ny) > maxSteps
      ) {
        continue;
      }
      cost[next] = steps;
      cameFrom[next] = index;
      queue.push(next, priority(next, steps));
    }
  }
  if (done[goal] !== 1) {
    return undefined;
  }
  const route: Point[] = [];
  for (let index = goal; index !== -1; index = cameFrom[index] ?? -1) {
    route.push({ x: index % width, y: Math.floor(index / width) });
  }
  return route.reverse();
}
