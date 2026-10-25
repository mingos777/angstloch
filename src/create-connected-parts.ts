import type { Grid } from './grid';
import type { Point } from './point';
import { Tile } from './tile';

/** The parts of a map that you can walk around in, and which of them have been joined since. */
export interface ConnectedParts {
  /** Whether two passable tiles are in the same part, or in parts that have been joined. */
  connected(a: Point, b: Point): boolean;
  /** Merges the parts of two passable tiles. */
  join(a: Point, b: Point): void;
}

const NEIGHBORS: readonly Point[] = [
  { x: 0, y: -1 },
  { x: 1, y: 0 },
  { x: 0, y: 1 },
  { x: -1, y: 0 },
];

/** Finds the parts of the grid made of floor and door tiles, which touch along tile edges. */
export function createConnectedParts(grid: Grid): ConnectedParts {
  const { width, height } = grid;
  const labels = new Int32Array(width * height).fill(-1);
  const parents: number[] = [];

  for (let y = 0; y < height; ++y) {
    for (let x = 0; x < width; ++x) {
      if (grid.get(x, y) === Tile.Wall || labels[y * width + x] !== -1) {
        continue;
      }
      const label = parents.length;
      parents.push(label);
      labels[y * width + x] = label;
      const queue: Point[] = [{ x, y }];
      for (let tile = queue.shift(); tile; tile = queue.shift()) {
        for (const step of NEIGHBORS) {
          const next = { x: tile.x + step.x, y: tile.y + step.y };
          if (
            grid.get(next.x, next.y) !== Tile.Wall &&
            labels[next.y * width + next.x] === -1
          ) {
            labels[next.y * width + next.x] = label;
            queue.push(next);
          }
        }
      }
    }
  }

  const root = ({ x, y }: Point): number => {
    let current = labels[y * width + x] ?? -1;
    for (let parent = parents[current]; parent !== current;) {
      current = parent ?? current;
      parent = parents[current];
    }
    return current;
  };

  return {
    connected: (a, b) => root(a) === root(b),
    join: (a, b) => {
      parents[root(a)] = root(b);
    },
  };
}
