import type { Point } from '../core/point';
import { assertAreaSize } from '../pipeline/assert-area-size';
import { assertWallBase } from '../pipeline/assert-wall-base';
import { buildInArea } from '../pipeline/build-in-area';
import { isFree } from '../pipeline/is-free';
import type { MapStep } from '../pipeline/map-step';
import { placeAreas } from '../pipeline/place-areas';
import { step } from '../pipeline/step';
import { assertDigMazeOptions } from './assert-dig-maze-options';
import { backtrackMaze } from './backtrack-maze';
import type { DigMazeOptions } from './dig-maze-options';
import { findMazeStart } from './find-maze-start';

/** The smallest side of a maze: one cell inside a wall frame. */
const MIN_SIDE = 3;

/** Throws a `RangeError` unless `start` is a maze cell of the map, and the maze is on the whole map. */
function assertStart(
  start: Point,
  width: number,
  height: number,
  wholeMap: boolean,
): void {
  const isCell = (value: number, length: number): boolean =>
    Number.isInteger(value) && value % 2 === 1 && value <= length - 2;
  if (!isCell(start.x, width) || !isCell(start.y, height)) {
    throw new RangeError(
      `start (${String(start.x)}, ${String(start.y)}) is not a maze cell: coordinates must be odd and inside the map`,
    );
  }
  if (!wholeMap) {
    throw new RangeError(
      'start can only be given for a maze on the whole map; in a smaller area, each maze starts at the free cell nearest the middle of its box',
    );
  }
}

/**
 * A step that carves a maze with the recursive backtracker algorithm.
 * Corridors run along odd coordinates, so odd sizes leave a single wall frame.
 * The maze keeps off every tile that is not free (see `isFree`): rooms and
 * other reserved tiles, and whatever earlier steps built, which can split the
 * maze into parts that are not joined, each carved in turn, the start's part
 * first; `openMazeRooms` joins them through the rooms. Each copy of `count`
 * goes in a box of `area`, on the lattice, and starts at `start` or at the
 * free cell nearest the middle of its box; a pattern turns about the middle
 * of the box. It reserves nothing, and adds `start`, the start of the first
 * copy (none when `count` gives no copy). The map has to start as wall, which
 * `pipeline` checks before the first attempt, and a `start` that is not free
 * fails the attempt. Throws a `RangeError` at once for a bad option.
 */
export function digMaze(
  options: DigMazeOptions = {},
): MapStep<object, { start?: Point }> {
  const {
    horizontalBias = 0,
    verticalBias = 0,
    loopChance = 0,
    fill = 1,
    straight = 0,
    pattern = 'none',
    patternChance = 1,
    start,
    area = {},
    count = { min: 1, max: 1 },
  } = options;
  assertDigMazeOptions(options);

  return step<object, { start?: Point }>(
    'digMaze',
    {
      adds: ['start'],
      validate: (state) => {
        const { width, height } = state.grid;
        assertWallBase('digMaze', state);
        assertAreaSize(area, count, width, height);
        if (
          Math.min(width, area.width?.min ?? width) < MIN_SIDE ||
          Math.min(height, area.height?.min ?? height) < MIN_SIDE
        ) {
          throw new RangeError(
            `digMaze needs a map and an area of at least ${String(MIN_SIDE)} by ${String(MIN_SIDE)} tiles, to hold a cell inside a wall frame`,
          );
        }
        if (start) {
          assertStart(
            start,
            width,
            height,
            (area.width?.min ?? width) === width &&
              (area.height?.min ?? height) === height,
          );
        }
      },
    },
    (state, { random }) => {
      const starts: Point[] = [];
      for (const box of placeAreas(state, random, area, count, {
        lattice: true,
      })) {
        buildInArea(state, box, (scratch) => {
          const { width, height } = scratch.grid;
          // taken before carving, since the maze's own floor is not in its way
          const blocked = new Uint8Array(width * height);
          for (let y = 0; y < height; ++y) {
            for (let x = 0; x < width; ++x) {
              blocked[y * width + x] = isFree(scratch, x, y) ? 0 : 1;
            }
          }
          const isBlocked = (x: number, y: number): boolean =>
            blocked[y * width + x] === 1;
          const from = start ?? findMazeStart(width, height, isBlocked);
          if (isBlocked(from.x, from.y)) {
            throw new RangeError(
              start
                ? `start (${String(start.x)}, ${String(start.y)}) is not free: a room or an earlier step has it`
                : `no free maze cell in the box at (${String(box.x)}, ${String(box.y)})`,
            );
          }
          backtrackMaze({
            grid: scratch.grid,
            random,
            start: from,
            horizontalBias,
            verticalBias,
            loopChance,
            fill,
            symmetry: pattern,
            symmetryChance: patternChance,
            straight,
            isBlocked,
          });
          starts.push({ x: from.x + box.x, y: from.y + box.y });
        });
      }
      const [first] = starts;
      return first ? { start: first } : {};
    },
  );
}
