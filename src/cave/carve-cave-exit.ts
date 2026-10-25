import type { Grid } from '../core/grid';
import { pickRandom } from '../core/pick-random';
import type { Point } from '../core/point';
import type { Random } from '../core/random';
import { Tile } from '../core/tile';

interface Candidate {
  edge: Point;
  step: Point;
  /** Number of walls between the edge and the first floor tile. */
  tunnel: number;
}

/** Counts the walls from the edge inwards up to the first floor tile, or returns undefined when something else comes first or there is no floor. */
function tunnelLength(
  grid: Grid,
  edge: Point,
  step: Point,
): number | undefined {
  let length = 0;
  for (
    let x = edge.x + step.x, y = edge.y + step.y;
    grid.inBounds(x, y);
    x += step.x, y += step.y
  ) {
    const tile = grid.get(x, y);
    if (tile === Tile.Floor) {
      return length;
    }
    if (tile !== Tile.Wall) {
      return undefined;
    }
    ++length;
  }
  return undefined;
}

/** The candidates of one side with the shortest tunnels. */
function findCandidates(
  grid: Grid,
  doors: readonly Point[],
  step: Point,
  edges: Point[],
): Candidate[] {
  const candidates: Candidate[] = [];
  for (const edge of edges) {
    const tile = grid.get(edge.x, edge.y);
    const tunnel = tunnelLength(grid, edge, step);
    const nextToDoor = doors.some(
      (door) =>
        Math.abs(door.x - edge.x) <= 1 && Math.abs(door.y - edge.y) <= 1,
    );
    if (
      (tile === Tile.Wall || tile === Tile.Floor) &&
      tunnel !== undefined &&
      !nextToDoor
    ) {
      candidates.push({ edge, step, tunnel });
    }
  }
  const shortest = Math.min(...candidates.map((candidate) => candidate.tunnel));
  return candidates.filter((candidate) => candidate.tunnel === shortest);
}

/** The coordinates along a side of the given length, without the corners. */
function along(length: number): number[] {
  return Array.from({ length: Math.max(0, length - 2) }, (_, i) => i + 1);
}

/**
 * Carves an exit into a random side of the grid, in place: a door on the
 * border and a straight tunnel leading to the nearest floor, found by going
 * straight in. On each side the exits with the shortest tunnels are the
 * candidates. A door is never next to one of the `doors` that exist already.
 * Returns the door position, or `undefined` when no side can be connected to
 * any floor.
 */
export function carveCaveExit(
  grid: Grid,
  random: Random,
  doors: readonly Point[],
): Point | undefined {
  const { width, height } = grid;
  const sides = [
    findCandidates(
      grid,
      doors,
      { x: 0, y: 1 },
      along(width).map((x) => ({ x, y: 0 })),
    ),
    findCandidates(
      grid,
      doors,
      { x: -1, y: 0 },
      along(height).map((y) => ({ x: width - 1, y })),
    ),
    findCandidates(
      grid,
      doors,
      { x: 0, y: -1 },
      along(width).map((x) => ({ x, y: height - 1 })),
    ),
    findCandidates(
      grid,
      doors,
      { x: 1, y: 0 },
      along(height).map((y) => ({ x: 0, y })),
    ),
  ].filter((candidates) => candidates.length > 0);

  if (sides.length === 0) {
    return undefined;
  }

  const { edge, step, tunnel } = pickRandom(random, pickRandom(random, sides));
  grid.set(edge.x, edge.y, Tile.Door);
  for (let i = 1; i <= tunnel; ++i) {
    grid.set(edge.x + step.x * i, edge.y + step.y * i, Tile.Floor);
  }
  return edge;
}
