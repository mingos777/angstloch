import { carveCaveExit } from '../cave/carve-cave-exit';
import type { Area } from '../core/area';
import { Grid } from '../core/grid';
import type { Point } from '../core/point';
import type { Exit } from '../rooms/exit';
import type { Room } from '../rooms/room';
import { randomInt } from '../core/random-int';
import { resolveRandom } from '../core/resolve-random';
import { createSimplexNoise } from '../noise/create-simplex-noise';
import { assertMineOptions } from './assert-mine-options';
import { layFishbone } from './lay-fishbone';
import { LANE_SPACING } from './dig-vein';
import { layCaverns } from './lay-caverns';
import { layRooms } from './lay-rooms';
import { layPillars } from './lay-pillars';
import { layRings } from './lay-rings';
import { layVeins } from './lay-veins';
import type { MineOptions } from './mine-options';
import type { MinePassage } from './mine-passage';
import type { MineResult } from './mine-result';

/** How many times in a row an exit may fail, for lack of room, before the generator stops trying. */
const EXIT_ATTEMPTS = 10;

/**
 * Generates a mine: a filled map with tunnels dug into it, which are always
 * one connected piece. With the `fishbone` layout the main shaft is dug first,
 * and then side tunnels branch off the existing ones until the `density` is
 * reached. With `veins`, tunnels join junctions spread over the map. With
 * `pillars`, a few large halls with islands of wall left standing in them are
 * joined by tunnels. The map is closed in by a ring of wall, except for the
 * exits. With `rings`, concentric loops are joined by spokes.
 */
export function generateMine(options: MineOptions): MineResult {
  assertMineOptions(options);
  const {
    width,
    height,
    density,
    shaftWidth = { min: 2, max: 3 },
    shaftWindiness = 0.1,
    angle = 'random',
    aditWidth = { min: 1, max: 2 },
    aditWindiness = 0.4,
    aditLength = { min: 15, max: 50 },
    branchAngle = { min: 45, max: 90 },
    loops = 0,
    veinWidth = { min: 1, max: 2 },
    veinWindiness = 0.5,
    veinSpacing = 16,
    layout = 'fishbone',
    rings,
    ringShape = 'oval',
    ringWidth = { min: 2, max: 3 },
    ringWobble = 0.5,
    spokes = { min: 1, max: 3 },
    caverns = { min: 0, max: 0 },
    cavernSize = { min: 12, max: 24 },
    cavernFill = 0.45,
    halls = { min: 2, max: 4 },
    templates = [],
    exitsPerRoom = { min: 1, max: 3 },
    doorChance = 1,
    hallVeins = { min: 2, max: 4 },
    hallSize,
    hallRagged = 0.5,
    pillarSize = { min: 2, max: 5 },
    pillarSpacing = { min: 2, max: 4 },
    pillarRagged = 0.5,
    pillarJitter = 0.5,
    minExits = 0,
  } = options;
  const maxExits = Math.max(minExits, options.maxExits ?? minExits);
  const random = resolveRandom(options.random);

  const grid = new Grid(width, height);
  const noise = createSimplexNoise(random);
  let laid: { passages: MinePassage[]; halls: Area[] };
  switch (layout) {
    case 'pillars':
      laid = layPillars(grid, random, noise, {
        density: density ?? 0.35,
        halls,
        hallVeins,
        hallSize,
        hallRagged,
        pillarSize,
        pillarSpacing,
        pillarRagged,
        pillarJitter,
        veinWidth,
        veinWindiness,
      });
      break;
    case 'rings':
      laid = {
        passages: layRings(grid, random, noise, {
          density: density ?? 0.3,
          rings,
          ringShape,
          ringWidth,
          ringWobble,
          spokes,
          veinWidth,
          veinWindiness,
        }),
        halls: [],
      };
      break;
    case 'veins':
      laid = {
        passages: layVeins(grid, random, noise, {
          density: density ?? 0.15,
          veinWidth,
          veinWindiness,
          veinSpacing,
        }),
        halls: [],
      };
      break;
    case 'fishbone':
      laid = {
        passages: layFishbone(grid, random, noise, {
          density: density ?? 0.15,
          shaftWidth,
          shaftWindiness,
          angle: angle === 'random' ? random() * 180 : angle,
          aditWidth,
          aditWindiness,
          aditLength,
          branchAngle,
          loops,
        }),
        halls: [],
      };
      break;
  }

  let cavernAreas: Area[] = [];
  if (caverns.max > 0) {
    const dug = layCaverns(
      grid,
      random,
      noise,
      { caverns, cavernSize, cavernFill, veinWidth, veinWindiness },
      0.5 + laid.passages.length * LANE_SPACING,
    );
    cavernAreas = dug.areas;
    laid.passages.push(...dug.passages);
  }

  let rooms: Room[] = [];
  let roomExits: Exit[] = [];
  if (options.rooms || templates.length > 0) {
    const dug = layRooms(
      grid,
      random,
      noise,
      {
        rooms: options.rooms,
        templates,
        doorChance,
        exitsPerRoom,
        veinWidth,
        veinWindiness,
      },
      0.5 + laid.passages.length * LANE_SPACING,
    );
    rooms = dug.rooms;
    roomExits = dug.roomExits;
    laid.passages.push(...dug.passages);
  }

  const exits: Point[] = [];
  const wanted = randomInt(random, minExits, maxExits);
  for (let misses = 0; exits.length < wanted && misses < EXIT_ATTEMPTS;) {
    const made = carveCaveExit(grid, random, exits);
    if (made.length === 0) {
      ++misses;
    }
    exits.push(...made);
  }

  return {
    grid,
    passages: laid.passages,
    halls: laid.halls,
    caverns: cavernAreas,
    rooms,
    roomExits,
    exits,
  };
}
