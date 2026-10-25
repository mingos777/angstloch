import { corridorTileCost } from './corridor-tile-cost';
import type { CorridorRules } from './corridor-tile-cost';
import { DIRECTIONS } from './directions';
import { MinHeap } from './min-heap';
import type { Point } from './point';

/** How many times longer than the direct way a corridor to a given tile may be, and how many tiles it may add on top. */
const DETOUR_FACTOR = 2;
const DETOUR_MARGIN = 16;

/** Memory that searches share, so that none has to allocate its own. A state holds data of the current search only if its `seen` stamp is the current `run`. */
export interface SearchBuffers {
  cost: Float64Array;
  previous: Int32Array;
  seen: Uint32Array;
  closed: Uint32Array;
  run: number;
}

export function createSearchBuffers(tiles: number): SearchBuffers {
  return {
    cost: new Float64Array(tiles * 4),
    previous: new Int32Array(tiles * 4),
    seen: new Uint32Array(tiles * 4),
    closed: new Uint32Array(tiles * 4),
    run: 0,
  };
}

export interface CorridorMap {
  search: SearchBuffers;
  width: number;
  height: number;
  /** Corridors move two tiles at a time, staying on odd coordinates. */
  lattice: boolean;
  /** Tiles that corridors must not use: room floors and the walls around them. */
  reserved: Uint8Array;
  /** Tiles that already hold a corridor. */
  corridor: Uint8Array;
  /** Extra cost per tile that makes corridors wander. */
  noise: Float32Array;
  /** Share of horizontal directions that corridors favor at each tile, which overrides the costs of moving horizontally and vertically. */
  steer?: Float32Array;
  /** Cost of moving one tile horizontally. */
  horizontalCost: number;
  /** Cost of moving one tile vertically. */
  verticalCost: number;
  /** Cost of changing direction. */
  turnCost: number;
  /** Cost of a tile on average, in tiles of the cheapest kind. Aiming at it makes the search faster, at the price of corridors that are not always the very cheapest. */
  averageCost: number;
}

/** Where a corridor should end: a tile, or any tile that passes a test, in which case the search heads for `aim`. */
export type CorridorTarget =
  | Point
  | {
      test: (x: number, y: number) => boolean;
      aim: Point;
      /** Search as far as it takes instead of giving up on long detours. */
      unbounded?: boolean;
    };

/**
 * Finds the cheapest corridor from a tile to a target with A*, or `undefined`
 * when there is none. The route stays inside the map border and away from
 * reserved tiles. Existing corridors are only crossed when `crossing` is set,
 * though the route may start from one and may end on a target one.
 * The result lists every tile from `from` to the end, both included.
 */
export function findCorridor(
  map: CorridorMap,
  from: Point,
  direction: number,
  target: CorridorTarget,
  crossing: boolean,
): Point[] | undefined {
  const { width } = map;
  const stride = map.lattice ? 2 : 1;
  const { search } = map;
  const run = ++search.run;
  const { previous, closed } = search;
  const open = new MinHeap<number>();
  const costOf = (state: number): number =>
    search.seen[state] === run ? (search.cost[state] as number) : Infinity;

  const stateOf = (x: number, y: number, d: number): number =>
    (y * width + x) * 4 + d;
  const aim = 'test' in target ? target.aim : target;
  const isTarget =
    'test' in target
      ? target.test
      : (x: number, y: number): boolean => x === target.x && y === target.y;
  const estimate = (x: number, y: number): number =>
    (Math.abs(x - aim.x) * map.horizontalCost +
      Math.abs(y - aim.y) * map.verticalCost) *
    map.averageCost;
  const rules: CorridorRules = { crossing, isTarget, from };
  const tileCost = (x: number, y: number, direction: number) =>
    corridorTileCost(map, x, y, direction, rules);

  const directionOf = (dx: number, dy: number): number =>
    dx === 0 ? (dy > 0 ? 2 : 0) : dx > 0 ? 1 : 3;

  /**
   * Cuts out loops of a corridor that comes back to touch itself, so that it
   * has no section two tiles wide and no diagonal jump. Returns `undefined` if
   * a jump cannot be removed.
   */
  const untangle = (path: Point[] | undefined): Point[] | undefined => {
    if (!path || stride === 2) {
      return path;
    }
    for (const [i, a] of path.entries()) {
      for (let j = path.length - 1; j >= i + 3; --j) {
        const b = path[j] as Point;
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        if (Math.abs(dx) > 1 || Math.abs(dy) > 1) {
          continue;
        }
        if (dx === 0 || dy === 0) {
          return untangle([...path.slice(0, i + 1), ...path.slice(j)]);
        }
        // diagonal: step through one of the two tiles that touch both ends
        for (const bridge of [
          { x: b.x, y: a.y },
          { x: a.x, y: b.y },
        ]) {
          const k = path.findIndex((p) => p.x === bridge.x && p.y === bridge.y);
          if (k > i) {
            return untangle([...path.slice(0, i + 1), ...path.slice(k)]);
          }
          if (k !== -1) {
            return untangle([...path.slice(0, k + 1), ...path.slice(j)]);
          }
          if (
            tileCost(
              bridge.x,
              bridge.y,
              directionOf(bridge.x - a.x, bridge.y - a.y),
            ) !== undefined
          ) {
            return untangle([
              ...path.slice(0, i + 1),
              bridge,
              ...path.slice(j),
            ]);
          }
        }
        return undefined;
      }
    }
    return path;
  };

  // a corridor that has to wind far around is not worth finding, and giving
  // up early spares searching the whole map when the target cannot be reached
  const limit =
    'test' in target && target.unbounded
      ? Infinity
      : estimate(from.x, from.y) * DETOUR_FACTOR +
        DETOUR_MARGIN * map.averageCost;

  const start = stateOf(from.x, from.y, direction);
  search.seen[start] = run;
  search.cost[start] = 0;
  previous[start] = -1;
  open.push(estimate(from.x, from.y), start);

  for (let state = open.pop(); state !== undefined; state = open.pop()) {
    if (closed[state] === run) {
      continue;
    }
    closed[state] = run;
    const facing = state % 4;
    const tile = (state - facing) / 4;
    const x = tile % width;
    const y = (tile - x) / width;
    if (isTarget(x, y)) {
      return untangle(trace(previous, state, width, stride));
    }

    for (const [next, step] of DIRECTIONS.entries()) {
      let stepCost = next === facing ? 0 : map.turnCost;
      for (let i = 1; i <= stride && stepCost !== Infinity; ++i) {
        const tileStep = tileCost(x + step.x * i, y + step.y * i, next);
        stepCost += tileStep ?? Infinity;
      }
      if (stepCost === Infinity) {
        continue;
      }
      const nx = x + step.x * stride;
      const ny = y + step.y * stride;
      const target = stateOf(nx, ny, next);
      const total = costOf(state) + stepCost;
      if (total < costOf(target) && total + estimate(nx, ny) <= limit) {
        search.seen[target] = run;
        search.cost[target] = total;
        previous[target] = state;
        open.push(total + estimate(nx, ny), target);
      }
    }
  }
  return undefined;
}

function trace(
  previous: Int32Array,
  last: number,
  width: number,
  stride: number,
): Point[] {
  const path: Point[] = [];
  for (let state = last; state !== -1; state = previous[state] as number) {
    const tile = (state - (state % 4)) / 4;
    const x = tile % width;
    const y = (tile - x) / width;
    const after = path.at(-1);
    if (after && stride === 2) {
      path.push({ x: (x + after.x) / 2, y: (y + after.y) / 2 });
    }
    path.push({ x, y });
  }
  return path.reverse();
}
