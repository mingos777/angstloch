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

/** Odd coordinates strictly inside a border of the given length. */
function latticeCoordinates(length: number): number[] {
  const result: number[] = [];
  for (let i = 1; i <= length - 2; i += 2) {
    result.push(i);
  }
  return result;
}

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

function findCandidates(grid: Grid, step: Point, edges: Point[]): Candidate[] {
  const candidates: Candidate[] = [];
  for (const edge of edges) {
    const tunnel = tunnelLength(grid, edge, step);
    if (grid.get(edge.x, edge.y) === Tile.Wall && tunnel !== undefined) {
      candidates.push({ edge, step, tunnel });
    }
  }
  return candidates;
}

/**
 * Carves an exit into a random side of the grid, in place: a door on the
 * border and a tunnel leading to the nearest floor. Returns the door position,
 * or `undefined` when no side can be connected to any floor.
 */
export function carveExit(grid: Grid, random: Random): Point | undefined {
  const { width, height } = grid;
  const sides = [
    findCandidates(
      grid,
      { x: 0, y: 1 },
      latticeCoordinates(width).map((x) => ({ x, y: 0 })),
    ),
    findCandidates(
      grid,
      { x: -1, y: 0 },
      latticeCoordinates(height).map((y) => ({ x: width - 1, y })),
    ),
    findCandidates(
      grid,
      { x: 0, y: -1 },
      latticeCoordinates(width).map((x) => ({ x, y: height - 1 })),
    ),
    findCandidates(
      grid,
      { x: 1, y: 0 },
      latticeCoordinates(height).map((y) => ({ x: 0, y })),
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
