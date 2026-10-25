import { assertDimensions } from './assert-dimensions';
import { assertFraction } from './assert-fraction';
import { assertRange } from './assert-range';
import { carveExit } from './carve-exit';
import { carveMaze } from './carve-maze';
import { findMazeStart } from './find-maze-start';
import { Grid } from './grid';
import type { MazeOptions } from './maze-options';
import type { MazeResult } from './maze-result';
import { openMazeRooms } from './open-maze-rooms';
import { prepareMazeRooms } from './prepare-maze-rooms';
import type { Point } from './point';
import { randomInt } from './random-int';
import { resolveRandom } from './resolve-random';

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
  if (options.start) {
    assertStart(options.start, cellsX, cellsY);
  }
  const exitsPerRoom = options.exitsPerRoom ?? { min: 1, max: 3 };
  const doorChance = options.doorChance ?? 1;
  assertRange('exitsPerRoom', exitsPerRoom, 1);
  assertFraction('doorChance', doorChance);
  if ((options.rooms || options.templates) && symmetry !== 'none') {
    throw new RangeError(
      'rooms and templates cannot be combined with a symmetry, since rooms break the pattern',
    );
  }

  const grid = new Grid(width, height);
  const { rooms, openings, isBlocked, reachExits } = prepareMazeRooms(
    random,
    grid,
    options,
    options.start,
    doorChance,
  );
  const start = options.start ?? findMazeStart(width, height, isBlocked);

  carveMaze({
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
    isBlocked,
  });
  reachExits();
  const roomExits = openMazeRooms(
    grid,
    random,
    rooms,
    openings,
    exitsPerRoom,
    doorChance,
  );

  const exits: Point[] = [];
  for (let i = randomInt(random, minExits, maxExits); i > 0; --i) {
    const exit = carveExit(grid, random);
    if (exit) {
      exits.push(exit);
    }
  }

  return { grid, start, exits, rooms, roomExits };
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
