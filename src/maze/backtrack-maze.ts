import type { Grid } from '../core/grid';
import type { MazeSymmetry } from './maze-options';
import { pickRandom } from '../core/pick-random';
import type { Point } from '../core/point';
import type { Random } from '../core/random';
import { Tile } from '../core/tile';

/** Moves between neighboring maze cells, which sit two tiles apart. */
const STEPS: readonly Point[] = [
  { x: 0, y: -2 },
  { x: 2, y: 0 },
  { x: 0, y: 2 },
  { x: -2, y: 0 },
];

/** Everything the backtracker needs; the maze options are already resolved. */
export interface MazeCarving {
  grid: Grid;
  random: Random;
  /** A maze cell with odd coordinates, which must not be blocked. */
  start: Point;
  horizontalBias: number;
  verticalBias: number;
  loopChance: number;
  fill: number;
  symmetry: MazeSymmetry;
  symmetryChance: number;
  straight: number;
  /** Tiles the maze must leave alone, such as the ones inside a room. A blocked cell is never carved, entered or looped into, and no passage is dug through a blocked tile. */
  isBlocked?: (x: number, y: number) => boolean;
}

/**
 * Carves a maze into the grid with the recursive backtracker algorithm,
 * starting from the start cell. Blocked cells can split the free cells into
 * separate regions; each is carved in turn, the start's region first. The
 * regions are not linked to each other.
 */
export function backtrackMaze(carving: MazeCarving): void {
  const {
    grid,
    random,
    start,
    horizontalBias,
    verticalBias,
    loopChance,
    fill,
    symmetry,
    symmetryChance,
    straight,
  } = carving;
  const { width, height } = grid;
  const isBlockedCell = carving.isBlocked ?? (() => false);

  const isInMap = (position: Point, step: Point): boolean => {
    const x = position.x + step.x;
    const y = position.y + step.y;
    return x >= 1 && x <= width - 2 && y >= 1 && y <= height - 2;
  };

  const isConnected = (position: Point, step: Point): boolean =>
    grid.get(position.x + step.x / 2, position.y + step.y / 2) === Tile.Floor;

  const isBlocked = (position: Point, step: Point): boolean =>
    isBlockedCell(position.x + step.x, position.y + step.y) ||
    isBlockedCell(position.x + step.x / 2, position.y + step.y / 2);

  const isVisited = (position: Point, step: Point): boolean =>
    isBlocked(position, step) ||
    grid.get(position.x + step.x, position.y + step.y) === Tile.Floor;

  const dig = (position: Point, step: Point): void => {
    grid.set(position.x + step.x / 2, position.y + step.y / 2, Tile.Floor);
    grid.set(position.x + step.x, position.y + step.y, Tile.Floor);
  };

  const isDeadEnd = (position: Point): boolean =>
    STEPS.filter(
      (step) => isInMap(position, step) && isConnected(position, step),
    ).length === 1;

  const pickOnAxis = (
    steps: readonly Point[],
    horizontal: boolean,
  ): Point | undefined => {
    const onAxis = steps.filter((step) =>
      horizontal ? step.y === 0 : step.x === 0,
    );
    return onAxis.length > 0 ? pickRandom(random, onAxis) : undefined;
  };

  const pickWeighted = (
    steps: readonly Point[],
    horizontalWeight: number,
    verticalWeight: number,
  ): Point | undefined => {
    const total = horizontalWeight + verticalWeight;
    if (total <= 0) {
      return undefined;
    }
    return pickOnAxis(steps, random() * total < horizontalWeight);
  };

  const pickStraight = (
    position: Point,
    steps: readonly Point[],
  ): Point | undefined => {
    const straightSteps = steps.filter(
      (step) =>
        grid.get(position.x - step.x / 2, position.y - step.y / 2) ===
        Tile.Floor,
    );
    return straightSteps.length > 0
      ? pickRandom(random, straightSteps)
      : undefined;
  };

  const pickSymmetric = (
    position: Point,
    steps: readonly Point[],
  ): Point | undefined => {
    const dx = position.x - Math.floor(width / 2);
    const dy = position.y - Math.floor(height / 2);
    const [ox, oy] = symmetry === 'whirlpool' ? [dy, -dx] : [dx, dy];
    const horizontal =
      Math.abs(ox) === Math.abs(oy)
        ? random() < 0.5
        : Math.abs(ox) > Math.abs(oy);
    return pickOnAxis(steps, horizontal);
  };

  // Direction rules are tried in order; the first that yields a step wins.
  const selectStep = (position: Point, steps: readonly Point[]): Point =>
    (straight > random() ? pickStraight(position, steps) : undefined) ??
    (symmetry !== 'none' && symmetryChance > random()
      ? pickSymmetric(position, steps)
      : undefined) ??
    (horizontalBias !== verticalBias
      ? pickWeighted(steps, horizontalBias, verticalBias)
      : undefined) ??
    pickRandom(random, steps);

  const createLoop = (position: Point): void => {
    const steps = STEPS.filter(
      (step) =>
        isInMap(position, step) &&
        !isConnected(position, step) &&
        !isBlocked(position, step) &&
        isVisited(position, step),
    );
    if (steps.length > 0) {
      dig(position, selectStep(position, steps));
    }
  };

  // Free cells are grouped into regions, each a set of cells that the
  // backtracker can reach from the region's seed.
  const key = ({ x, y }: Point): number => y * width + x;
  const seen = new Set<number>([key(start)]);
  const floodRegion = (seed: Point): void => {
    const queue = [seed];
    for (let cell = queue.shift(); cell; cell = queue.shift()) {
      for (const step of STEPS) {
        const next = { x: cell.x + step.x, y: cell.y + step.y };
        if (
          isInMap(cell, step) &&
          !isBlocked(cell, step) &&
          !seen.has(key(next))
        ) {
          seen.add(key(next));
          queue.push(next);
        }
      }
    }
  };
  floodRegion(start);
  const seeds: Point[] = [start];
  for (let y = 1; y <= height - 2; y += 2) {
    for (let x = 1; x <= width - 2; x += 2) {
      const cell = { x, y };
      if (!isBlockedCell(x, y) && !seen.has(key(cell))) {
        seen.add(key(cell));
        floodRegion(cell);
        seeds.push(cell);
      }
    }
  }
  const total = seen.size;

  let filled = 0;
  for (const [index, seed] of seeds.entries()) {
    // the start's region is always carved, whatever `fill` says
    if (index > 0 && filled / total >= fill) {
      break;
    }
    grid.set(seed.x, seed.y, Tile.Floor);
    ++filled;
    const visited: Point[] = [seed];

    for (;;) {
      const current = visited.at(-1);
      if (current === undefined) {
        break;
      }

      // once enough is carved, the stack is still unwound so that loops can form
      const steps =
        filled / total >= fill
          ? []
          : STEPS.filter(
              (step) => isInMap(current, step) && !isVisited(current, step),
            );
      if (steps.length > 0) {
        const step = selectStep(current, steps);
        dig(current, step);
        visited.push({ x: current.x + step.x, y: current.y + step.y });
        ++filled;
      } else {
        visited.pop();
        // loops are only considered at dead ends
        if (isDeadEnd(current) && loopChance > random()) {
          createLoop(current);
        }
      }
    }
  }
}
