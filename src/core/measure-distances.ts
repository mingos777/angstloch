import { assertDistanceMetric } from './assert-distance-metric';
import { assertTile } from './assert-tile';
import { DIRECTIONS } from './directions';
import type { DistanceMetric } from './distance-metric';
import type { Grid } from './grid';
import type { MeasureDistancesOptions } from './measure-distances-options';
import { MinHeap } from './min-heap';
import type { Point } from './point';
import { Tile } from './tile';

/** A step to a neighbor, with its length before the factor of the tile it enters. */
interface Move {
  dx: number;
  dy: number;
  length: number;
}

/** The length of a diagonal step by the euclidean metric. */
const DIAGONAL = Math.SQRT2;

const CORNERS: readonly Point[] = [
  { x: 1, y: -1 },
  { x: 1, y: 1 },
  { x: -1, y: 1 },
  { x: -1, y: -1 },
];

const STRAIGHT: readonly Move[] = DIRECTIONS.map(({ x, y }) => ({
  dx: x,
  dy: y,
  length: 1,
}));

const MOVES: Record<DistanceMetric, readonly Move[]> = {
  manhattan: STRAIGHT,
  chebyshev: [
    ...STRAIGHT,
    ...CORNERS.map(({ x, y }) => ({ dx: x, dy: y, length: 1 })),
  ],
  euclidean: [
    ...STRAIGHT,
    ...CORNERS.map(({ x, y }) => ({ dx: x, dy: y, length: DIAGONAL })),
  ],
};

const DEFAULT_COSTS: Partial<Record<Tile, number>> = {
  [Tile.Wall]: Infinity,
  [Tile.DeepWater]: Infinity,
};

/**
 * Measures the walk between every two places of a finished map. A place is a
 * list of tiles (a room, a clearing, an exit, anything); the tiles of a place
 * that cannot be entered are left out of it. Returns a places by places
 * matrix: row `a`, column `b` holds the cheapest walk from the nearest tile of
 * place `a` to the nearest tile of place `b`, 0 where they share a tile, and
 * -1 where there is no way, or where either place has no tile that can be
 * entered. Each step costs its length times the factor of the tile it enters,
 * so the walk from `a` to `b` and the one back differ when the tiles they end
 * on have different factors. Throws a `RangeError` for a tile outside the
 * grid, a factor that is not positive, or an unknown metric.
 */
export function measureDistances(
  grid: Grid,
  places: readonly (readonly Point[])[],
  options: MeasureDistancesOptions = {},
): number[][] {
  const metric = options.metric ?? 'euclidean';
  assertDistanceMetric('metric', metric);
  const factors = tileFactors(grid, options.costs ?? {});
  const tiles = places.map((place, index) =>
    enterableTiles(grid, factors, place, index),
  );
  return tiles.map((from) => {
    if (from.length === 0) {
      return tiles.map(() => -1);
    }
    const reached = walk(grid, factors, from, MOVES[metric]);
    return tiles.map((to) => nearest(reached, to));
  });
}

/** The cost factor of entering each tile of the grid, row by row. */
function tileFactors(
  grid: Grid,
  costs: Partial<Record<Tile, number>>,
): Float64Array {
  for (const [key, factor] of Object.entries<number>(costs)) {
    assertTile('a key of costs', Number(key));
    if (!(factor > 0)) {
      throw new RangeError(
        `costs[${key}] must be a number > 0 or Infinity, got ${String(factor)}`,
      );
    }
  }
  const byTile: Partial<Record<Tile, number>> = { ...DEFAULT_COSTS, ...costs };
  const factors = new Float64Array(grid.width * grid.height);
  for (let y = 0; y < grid.height; ++y) {
    for (let x = 0; x < grid.width; ++x) {
      factors[y * grid.width + x] = byTile[grid.get(x, y)] ?? 1;
    }
  }
  return factors;
}

/** The indices of the tiles of a place that can be entered. */
function enterableTiles(
  grid: Grid,
  factors: Float64Array,
  place: readonly Point[],
  index: number,
): number[] {
  const tiles: number[] = [];
  for (const { x, y } of place) {
    if (!grid.inBounds(x, y)) {
      throw new RangeError(
        `places[${String(index)}] has the tile (${String(x)}, ${String(y)}) outside the ${String(grid.width)}x${String(grid.height)} grid`,
      );
    }
    const tile = y * grid.width + x;
    if (Number.isFinite(factors[tile])) {
      tiles.push(tile);
    }
  }
  return tiles;
}

/** Dijkstra's search from all the given tiles at once: the cost of the cheapest walk to every tile, `Infinity` where there is none. */
function walk(
  grid: Grid,
  factors: Float64Array,
  from: readonly number[],
  moves: readonly Move[],
): Float64Array {
  const { width, height } = grid;
  const reached = new Float64Array(width * height).fill(Infinity);
  const done = new Uint8Array(width * height);
  const heap = new MinHeap<number>();
  for (const tile of from) {
    reached[tile] = 0;
    heap.push(0, tile);
  }
  for (let tile = heap.pop(); tile !== undefined; tile = heap.pop()) {
    // a tile may be queued more than once; its first pop is the cheapest
    if (done[tile]) {
      continue;
    }
    done[tile] = 1;
    const x = tile % width;
    const y = (tile - x) / width;
    const cost = reached[tile] as number;
    for (const { dx, dy, length } of moves) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || nx >= width || ny < 0 || ny >= height) {
        continue;
      }
      const next = ny * width + nx;
      const through = cost + length * (factors[next] as number);
      if (through < (reached[next] as number)) {
        reached[next] = through;
        heap.push(through, next);
      }
    }
  }
  return reached;
}

/** The cheapest of the reached costs of the given tiles, or -1 when none was reached. */
function nearest(reached: Float64Array, tiles: readonly number[]): number {
  let best = Infinity;
  for (const tile of tiles) {
    best = Math.min(best, reached[tile] as number);
  }
  return Number.isFinite(best) ? best : -1;
}
