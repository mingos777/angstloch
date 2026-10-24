import { assertDimensions } from './assert-dimensions';
import { carveExit } from './carve-exit';
import { Grid } from './grid';
import type { MazeOptions } from './maze-options';
import type { MazeResult } from './maze-result';
import { pickRandom } from './pick-random';
import type { Point } from './point';
import { randomInt } from './random-int';
import { resolveRandom } from './resolve-random';
import { Tile } from './tile';

/** Moves between neighbouring maze cells, which sit two tiles apart. */
const STEPS: readonly Point[] = [
  { x: 0, y: -2 },
  { x: 2, y: 0 },
  { x: 0, y: 2 },
  { x: -2, y: 0 },
];

/**
 * Generates a maze with the recursive backtracker algorithm. Corridors run
 * along odd coordinates, so odd map dimensions leave a single wall frame.
 */
export function generateMaze(options: MazeOptions): MazeResult {
  const {
    width,
    height,
    horizontalBias = 0,
    verticalBias = 0,
    loopChance = 0,
    fill = 1,
    symmetry = 'none',
    symmetryChance = 1,
    straight = 0,
    minExits = 0,
  } = options;
  const maxExits = Math.max(minExits, options.maxExits ?? minExits);

  assertDimensions(width, height, 3);
  const random = resolveRandom(options.random);
  const cellsX = Math.floor((width - 1) / 2);
  const cellsY = Math.floor((height - 1) / 2);
  const start = options.start ?? {
    x: 1 + 2 * Math.floor(cellsX / 2),
    y: 1 + 2 * Math.floor(cellsY / 2),
  };
  assertStart(start, cellsX, cellsY);

  const grid = new Grid(width, height);
  const maxFilled = cellsX * cellsY;

  const isInMap = (position: Point, step: Point): boolean => {
    const x = position.x + step.x;
    const y = position.y + step.y;
    return x >= 1 && x <= width - 2 && y >= 1 && y <= height - 2;
  };

  const isConnected = (position: Point, step: Point): boolean =>
    grid.get(position.x + step.x / 2, position.y + step.y / 2) === Tile.Floor;

  const isVisited = (position: Point, step: Point): boolean =>
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
        isVisited(position, step),
    );
    if (steps.length > 0) {
      dig(position, selectStep(position, steps));
    }
  };

  grid.set(start.x, start.y, Tile.Floor);
  const visited: Point[] = [start];
  let filled = 1;

  for (;;) {
    const current = visited.at(-1);
    if (current === undefined) {
      break;
    }

    // once enough is carved, the stack is still unwound so that loops can form
    const steps =
      filled / maxFilled >= fill
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

  const exits: Point[] = [];
  for (let i = randomInt(random, minExits, maxExits); i > 0; --i) {
    const exit = carveExit(grid, random);
    if (exit) {
      exits.push(exit);
    }
  }

  return { grid, start, exits };
}

function assertStart(start: Point, cellsX: number, cellsY: number): void {
  const isCell = (value: number, cells: number): boolean =>
    Number.isInteger(value) && value % 2 === 1 && value <= 2 * cells - 1;

  if (!isCell(start.x, cellsX) || !isCell(start.y, cellsY)) {
    throw new RangeError(
      `start (${String(start.x)}, ${String(start.y)}) is not a maze cell: coordinates must be odd and inside the map`,
    );
  }
}
