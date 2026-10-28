import { DIRECTIONS } from '../core/directions';
import type { Point } from '../core/point';
import type { MapState } from './map-state';
import { Reserve } from './reserve';

/** An `Openable` tile that `findNearestOpenable` found, and the way to it. */
export interface NearestOpenable {
  /** The `Openable` tile. */
  openable: Point;
  /** The free tile next to it that the search reached it from. */
  outside: Point;
  /** Index into `DIRECTIONS` of the way from `openable` to `outside`, the way out of whatever the tile belongs to. */
  direction: number;
  /** Index into `from` of the start that the search came from. */
  start: number;
}

/**
 * Finds the `Openable` tile nearest to any of the starts, such as the
 * potential exit of a room, by a breadth-first search over the tiles that are
 * not reserved and not marked by `blocked`. Diagonal steps are not taken. The
 * tile is reached from a free neighbor, which says the way out of it. An
 * `Openable` tile that `accepts` turns down is passed over. Returns
 * `undefined` when there is none to reach.
 */
export function findNearestOpenable(
  state: Pick<MapState, 'grid' | 'reserved'>,
  from: readonly Point[],
  options: {
    /** One byte per tile, 1 for a tile the search may not pass. */
    blocked?: Uint8Array;
    /** Whether an `Openable` tile, reached on the given way out, will do. */
    accepts?: (openable: Point, direction: number) => boolean;
  } = {},
): NearestOpenable | undefined {
  const { grid, reserved } = state;
  const { width } = grid;
  const { blocked, accepts } = options;
  // the start each tile was reached from, -1 for none yet
  const origin = new Int32Array(width * grid.height).fill(-1);
  const queue: number[] = [];
  for (const [start, { x, y }] of from.entries()) {
    if (grid.inBounds(x, y) && origin[y * width + x] === -1) {
      origin[y * width + x] = start;
      queue.push(y * width + x);
    }
  }
  for (let head = 0; head < queue.length; ++head) {
    const at = queue[head] as number;
    const x = at % width;
    const y = (at - x) / width;
    for (const [way, step] of DIRECTIONS.entries()) {
      const [nx, ny] = [x + step.x, y + step.y];
      if (!grid.inBounds(nx, ny)) {
        continue;
      }
      const next = ny * width + nx;
      const openable = { x: nx, y: ny };
      const direction = (way + 2) % 4;
      if (
        reserved[next] === Reserve.Openable &&
        (accepts?.(openable, direction) ?? true)
      ) {
        return {
          openable,
          outside: { x, y },
          direction,
          start: origin[at] as number,
        };
      }
      if (
        origin[next] === -1 &&
        reserved[next] === Reserve.None &&
        !blocked?.[next]
      ) {
        origin[next] = origin[at] as number;
        queue.push(next);
      }
    }
  }
  return undefined;
}
