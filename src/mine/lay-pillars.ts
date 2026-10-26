import type { Area } from '../core/area';
import type { Grid } from '../core/grid';
import type { Point } from '../core/point';
import type { Random } from '../core/random';
import { randomInt } from '../core/random-int';
import type { Range } from '../core/range';
import { Tile } from '../core/tile';
import type { NoiseFunction } from '../noise/noise-function';
import { createRaggedMask } from './create-ragged-mask';
import { MARGIN } from './dig-vein';
import { growHallNetwork } from './grow-hall-network';
import type { MineHallEntrances } from './mine-hall-entrances';
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
  /** How many veins to dig between the halls in all. The ones that join every hall come first and are dug whatever this says. */
  hallVeins: Range;
  /** Where a vein starts and ends in a hall. */
  hallEntrances: MineHallEntrances;
  /** The size of a hall's sides. Without it, a size that makes the halls fill about the density. */
  hallSize?: Range;
  hallRagged: number;
  pillarSize: Range;
  pillarSpacing: Range;
  pillarRagged: number;
  pillarJitter: number;
  veinWidth: Range;
  veinWindiness: number;
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

/** Looks for a place where a hall of the size fits, apart from the others. */
function tryPlace(
  random: Random,
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
    if (!isCrowded(hall, halls, HALL_GAP)) {
      return hall;
    }
  }
  return undefined;
}

/** Turns the tiles of a hall, which has ragged edges, into floor. Returns them. */
function carveHall(
  grid: Grid,
  random: Random,
  hall: Area,
  ragged: number,
): Point[] {
  const mask = createRaggedMask(random, hall.width, hall.height, ragged);
  const tiles: Point[] = [];
  for (let y = 0; y < hall.height; ++y) {
    for (let x = 0; x < hall.width; ++x) {
      if (mask[y * hall.width + x] === 1) {
        grid.set(hall.x + x, hall.y + y, Tile.Floor);
        tiles.push({ x: hall.x + x, y: hall.y + y });
      }
    }
  }
  return tiles;
}

/** Places halls at random where they fit, as many as there is room for, and carves them. Returns the halls, and the tiles of floor of each. */
function digHalls(
  grid: Grid,
  random: Random,
  settings: PillarsSettings,
  pillarLoss: number,
): { halls: Area[]; floors: Point[][] } {
  const interiorWidth = grid.width - 2 * MARGIN;
  const interiorHeight = grid.height - 2 * MARGIN;
  const halls: Area[] = [];
  const floors: Point[][] = [];
  if (interiorWidth < 1 || interiorHeight < 1) {
    return { halls, floors };
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
        random,
        halls,
        interiorWidth,
        interiorHeight,
        hallWidth,
        hallHeight,
      );
      if (hall) {
        floors.push(carveHall(grid, random, hall, settings.hallRagged));
        halls.push(hall);
        break;
      }
    }
  }
  return { halls, floors };
}

/**
 * Digs a room-and-pillar mine into the grid and returns its halls and the
 * veins that join them. A few large halls of floor are placed apart from one
 * another and joined into a network of veins that are routed through the rock
 * around the halls (see `growHallNetwork`). Last, pillars are left standing in
 * the halls.
 */
export function layPillars(
  grid: Grid,
  random: Random,
  noise: NoiseFunction,
  settings: PillarsSettings,
): { passages: MinePassage[]; halls: Area[] } {
  const { pillarSize, pillarSpacing } = settings;
  const cell =
    average(pillarSize) / (average(pillarSize) + average(pillarSpacing));
  const pillarLoss = cell * cell * PILLAR_SUCCESS;
  const { halls, floors } = digHalls(grid, random, settings, pillarLoss);

  const { passages, joined } = growHallNetwork(
    grid,
    random,
    noise,
    halls,
    floors,
    settings,
  );
  // a hall that no vein could reach, which should not happen, is filled in
  for (const [index, tiles] of floors.entries()) {
    if (!joined.has(index)) {
      for (const { x, y } of tiles) {
        grid.set(x, y, Tile.Wall);
      }
    }
  }
  const keptHalls = halls.filter((_, index) => joined.has(index));

  const keep = new Set<number>();
  for (const { tiles } of passages) {
    for (const { x, y } of tiles) {
      keep.add(y * grid.width + x);
    }
  }
  for (const hall of keptHalls) {
    placePillars(grid, random, hall, keep, {
      size: pillarSize,
      spacing: pillarSpacing,
      ragged: settings.pillarRagged,
      jitter: settings.pillarJitter,
    });
  }
  return { passages, halls: keptHalls };
}
