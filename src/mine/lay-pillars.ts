import type { Area } from '../core/area';
import type { Grid } from '../core/grid';
import type { Random } from '../core/random';
import { randomInt } from '../core/random-int';
import type { Range } from '../core/range';
import { Tile } from '../core/tile';
import { createRaggedMask } from './create-ragged-mask';
import { MARGIN } from './dig-vein';
import type { MinePassage } from './mine-passage';
import { placePillars } from './place-pillars';

/** The walls that stay between two halls, so that they do not merge. */
const HALL_GAP = 4;
/** The smallest side of a hall that has no size of its own, unless the map is smaller. */
const MIN_HALL_SIDE = 5;
/** How many places to try for a hall before leaving it out. */
const HALL_ATTEMPTS = 100;
/** The share of the pillars that find room, as a guess. */
const PILLAR_SUCCESS = 0.8;

/** The settings of the pillars layout, with every default filled in. */
export interface PillarsSettings {
  density: number;
  halls: Range;
  /** The size of a hall's sides. Without it, a size that makes the halls fill about the density. */
  hallSize?: Range;
  hallRagged: number;
  pillarSize: Range;
  pillarSpacing: Range;
  pillarRagged: number;
  pillarJitter: number;
  /** Tiles that are never dug, a byte for each tile of the grid, row by row: anything but 0 protects it. No hall covers one. Defaults to none. */
  protect?: Uint8Array;
}

const average = (range: Range) => (range.min + range.max) / 2;

/** Whether the rectangle is within `gap` tiles of any of the others. */
function isCrowded(area: Area, others: readonly Area[], gap: number): boolean {
  return others.some(
    (other) =>
      area.x < other.x + other.width + gap &&
      other.x < area.x + area.width + gap &&
      area.y < other.y + other.height + gap &&
      other.y < area.y + area.height + gap,
  );
}

/** Whether any tile of the rectangle is marked in `protect`. */
function isProtected(
  area: Area,
  gridWidth: number,
  protect: Uint8Array | undefined,
): boolean {
  if (!protect) {
    return false;
  }
  for (let y = area.y; y < area.y + area.height; ++y) {
    for (let x = area.x; x < area.x + area.width; ++x) {
      if ((protect[y * gridWidth + x] ?? 0) !== 0) {
        return true;
      }
    }
  }
  return false;
}

/** Looks for a place where a hall of the size fits, apart from the others and off the protected tiles. */
function tryPlace(
  grid: Grid,
  random: Random,
  protect: Uint8Array | undefined,
  halls: readonly Area[],
  interiorWidth: number,
  interiorHeight: number,
  width: number,
  height: number,
): Area | undefined {
  for (let attempt = 0; attempt < HALL_ATTEMPTS; ++attempt) {
    const hall = {
      x: MARGIN + randomInt(random, 0, interiorWidth - width),
      y: MARGIN + randomInt(random, 0, interiorHeight - height),
      width,
      height,
    };
    if (
      !isCrowded(hall, halls, HALL_GAP) &&
      !isProtected(hall, grid.width, protect)
    ) {
      return hall;
    }
  }
  return undefined;
}

/** Turns the tiles of a hall, which has ragged edges, into floor. */
function carveHall(
  grid: Grid,
  random: Random,
  hall: Area,
  ragged: number,
): void {
  const mask = createRaggedMask(random, hall.width, hall.height, ragged);
  for (let y = 0; y < hall.height; ++y) {
    for (let x = 0; x < hall.width; ++x) {
      if (mask[y * hall.width + x] === 1) {
        grid.set(hall.x + x, hall.y + y, Tile.Floor);
      }
    }
  }
}

/** Places halls at random where they fit, as many as there is room for, and carves them. Returns the halls. */
function digHalls(
  grid: Grid,
  random: Random,
  settings: PillarsSettings,
  pillarLoss: number,
): { halls: Area[] } {
  const interiorWidth = grid.width - 2 * MARGIN;
  const interiorHeight = grid.height - 2 * MARGIN;
  const halls: Area[] = [];
  if (interiorWidth < 1 || interiorHeight < 1) {
    return { halls };
  }
  const count = randomInt(random, settings.halls.min, settings.halls.max);
  const share =
    (settings.density * grid.width * grid.height) / count / (1 - pillarLoss);
  const side = (range: Range, interior: number) =>
    Math.min(interior, randomInt(random, range.min, range.max));
  for (let n = 0; n < count; ++n) {
    let width: number;
    let height: number;
    if (settings.hallSize) {
      width = side(settings.hallSize, interiorWidth);
      height = side(settings.hallSize, interiorHeight);
    } else {
      // an area that is about the share, in a shape that is a little wide or tall
      const ratio = 0.7 + 0.7 * random();
      width = Math.round(Math.sqrt(share * ratio));
      height = Math.round(share / Math.max(1, width));
    }
    // a hall of a size of its own is left out when it has no room, and one
    // that has none shrinks until it has room
    for (let scale = 1; scale > 0; scale -= settings.hallSize ? 1 : 0.15) {
      const fit = (size: number, interior: number) =>
        Math.min(
          interior,
          Math.max(Math.min(MIN_HALL_SIDE, interior), Math.round(size * scale)),
        );
      const hallWidth = settings.hallSize ? width : fit(width, interiorWidth);
      const hallHeight = settings.hallSize
        ? height
        : fit(height, interiorHeight);
      const hall = tryPlace(
        grid,
        random,
        settings.protect,
        halls,
        interiorWidth,
        interiorHeight,
        hallWidth,
        hallHeight,
      );
      if (hall) {
        carveHall(grid, random, hall, settings.hallRagged);
        halls.push(hall);
        break;
      }
    }
  }
  return { halls };
}

/**
 * Digs the halls of a room-and-pillar mine into the grid and returns them. A
 * few large halls of floor are placed apart from one another, and pillars are
 * left standing in them. No hall covers a tile of `protect`. The halls are
 * left apart: `digHallVeins` joins them. The passages come back empty, since
 * this digs none.
 */
export function layPillars(
  grid: Grid,
  random: Random,
  settings: PillarsSettings,
): { passages: MinePassage[]; halls: Area[] } {
  const { pillarSize, pillarSpacing } = settings;
  const cell =
    average(pillarSize) / (average(pillarSize) + average(pillarSpacing));
  const pillarLoss = cell * cell * PILLAR_SUCCESS;
  const { halls } = digHalls(grid, random, settings, pillarLoss);
  for (const hall of halls) {
    placePillars(grid, random, hall, {
      size: pillarSize,
      spacing: pillarSpacing,
      ragged: settings.pillarRagged,
      jitter: settings.pillarJitter,
    });
  }
  return { passages: [], halls };
}
