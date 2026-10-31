import type { Area } from '../core/area';
import { pickRandom } from '../core/pick-random';
import type { Random } from '../core/random';
import { randomInt } from '../core/random-int';
import type { Range } from '../core/range';
import { shuffle } from '../core/shuffle';
import { isFree } from '../pipeline/is-free';
import type { MapState } from '../pipeline/map-state';
import type { CisternSide } from './cistern-side';
import type { DigSewersOptions } from './dig-sewers-options';
import { lineArea } from './line-area';
import { mouthRocks } from './mouth-rocks';
import { pickLedges } from './pick-ledges';
import type { SewerLine } from './sewer-line';
import { tunnelArea } from './tunnel-area';
import {
  MIN_SEWER_ACROSS,
  MIN_SEWER_ALONG,
  MOUTH_ROCK,
  SEWER_GAP,
} from './sewer-limits';

/** The options of `digSewers` that shape one sewer, with every default filled in. */
export type SewerSettings = Required<Omit<DigSewersOptions, 'area' | 'count'>>;

/** Which sides of a sewer's area lie on the border of the map. */
export interface SewerBorders {
  left: boolean;
  top: boolean;
  right: boolean;
  bottom: boolean;
}

/** Spots tried for each branch before it is left out. */
const BRANCH_TRIES = 30;

/** Every tile of the box, clipped to the map. */
function tilesOf(
  box: Area,
  width: number,
  height: number,
): { x: number; y: number }[] {
  const tiles: { x: number; y: number }[] = [];
  for (
    let y = Math.max(0, box.y);
    y < Math.min(height, box.y + box.height);
    ++y
  ) {
    for (
      let x = Math.max(0, box.x);
      x < Math.min(width, box.x + box.width);
      ++x
    ) {
      tiles.push({ x, y });
    }
  }
  return tiles;
}

/** The side of a box that faces `step` along a line that is `horizontal` or not, or across it. */
function sideOf(
  horizontal: boolean,
  axis: 'along' | 'across',
  step: 1 | -1,
): CisternSide {
  return horizontal === (axis === 'along')
    ? step === 1
      ? 'right'
      : 'left'
    : step === 1
      ? 'bottom'
      : 'top';
}

function grow(box: Area, by: number): Area {
  return {
    x: box.x - by,
    y: box.y - by,
    width: box.width + 2 * by,
    height: box.height + 2 * by,
  };
}

/**
 * Plans a sewer on the whole map of `state`, a scratch map of its area: a
 * trunk along it, then branches at right angles off the trunk or off earlier
 * branches, each meeting its parent in a junction chamber, some ending in a
 * head chamber. As many junctions and heads as `cisterns` draws, where they
 * find room, are cisterns instead, larger, each with the sides that get a
 * ledge (see `pickLedges`). The trunk reaches the border of the map, which `borders`
 * tells, at its outfalls. Every floor keeps a ring of wall inside the map, the rock
 * behind each mouth stays on the map, and the parts that do not meet keep
 * `SEWER_GAP` tiles of rock between them. Only free tiles (see `isFree`) are
 * used. A branch with no room is left out. Changes nothing. Throws an
 * ordinary `Error` when the trunk finds no room, or the area has no room for
 * `outfalls.min` outfalls, which `pipeline` answers with a new map.
 */
export function planSewer(
  state: MapState,
  random: Random,
  settings: SewerSettings,
  borders: SewerBorders,
): SewerLine[] {
  const { width, height } = state.grid;
  // 1 + the id of the part that holds each tile, 0 for none
  const taken = new Int32Array(width * height);
  let parts = 0;
  const claim = (boxes: readonly Area[]): number => {
    const id = ++parts;
    for (const box of boxes) {
      for (const { x, y } of tilesOf(box, width, height)) {
        taken[y * width + x] = id;
      }
    }
    return id;
  };
  /** Whether floors and rock fit, kept apart from every part but `allowed`. */
  const fits = (
    floors: readonly Area[],
    rocks: readonly Area[],
    allowed: number,
  ): boolean => {
    const inside = floors.every(
      ({ x, y, width: w, height: h }) =>
        x >= 1 && y >= 1 && x + w <= width - 1 && y + h <= height - 1,
    );
    const onMap = rocks.every(
      ({ x, y, width: w, height: h }) =>
        x >= 0 && y >= 0 && x + w <= width && y + h <= height,
    );
    return (
      inside &&
      onMap &&
      [...floors.map((floor) => grow(floor, 1)), ...rocks].every((box) =>
        tilesOf(box, width, height).every(({ x, y }) => isFree(state, x, y)),
      ) &&
      [...floors.map((floor) => grow(floor, SEWER_GAP)), ...rocks].every(
        (box) =>
          tilesOf(box, width, height).every(({ x, y }) => {
            const id = taken[y * width + x] ?? 0;
            return id === 0 || id === allowed;
          }),
      )
    );
  };
  const draw = (range: Range) => randomInt(random, range.min, range.max);

  const lines: SewerLine[] = [];
  // the id of the tunnel of each line
  const ids: number[] = [];
  const trunk = planTrunk(width, height, random, settings, borders).find(
    (line) => fits([tunnelArea(line)], mouthRocks(line), 0),
  );
  if (!trunk) {
    throw new Error(
      `digSewers found no free room for the trunk in an area of ${String(width)} by ${String(height)} tiles; run it before the steps that fill the area, or give it a larger area`,
    );
  }
  lines.push(trunk);
  ids.push(claim([tunnelArea(trunk), ...mouthRocks(trunk)]));

  /** Tries a branch at a random spot, its junction or its head a cistern when asked, and tells whether it fits. */
  const tryBranch = (cistern?: 'junction' | 'head'): boolean => {
    // a parent picked by the length of its tunnel
    let spot = randomInt(
      random,
      0,
      lines.reduce((sum, { tunnel }) => sum + tunnel.max - tunnel.min + 1, 0) -
        1,
    );
    const index = lines.findIndex(({ tunnel }) => {
      spot -= tunnel.max - tunnel.min + 1;
      return spot < 0;
    });
    const parent = lines[index] as SewerLine;
    const outward = random() < 0.5 ? 1 : -1;
    const width = draw(settings.branchWidth);
    // the junction chamber, its size along the parent and across it: it
    // holds the parent's tunnel and reaches past it on the branch's side only;
    // a cistern has room for a ledge beyond the parent's water and a basin
    const atJunction = cistern === 'junction';
    const size = atJunction ? settings.cisternSize : settings.chamberSize;
    const along = Math.max(draw(size), width + 4);
    const across = Math.max(draw(size), parent.width + (atJunction ? 4 : 3));
    const first = parent.tunnel.min + 2;
    const last = parent.tunnel.max - 2 - along + 1;
    if (last < first) {
      return false;
    }
    const start = randomInt(random, first, last);
    const reach = across - parent.width - 2;
    const side =
      outward === 1
        ? {
            min: parent.across - 1,
            max: parent.across + parent.width + reach,
          }
        : {
            min: parent.across - 1 - reach,
            max: parent.across + parent.width,
          };
    const junction = lineArea(
      parent.horizontal,
      { min: start, max: start + along - 1 },
      side,
    );
    if (!fits([junction], [], ids[index] as number)) {
      return false;
    }
    // a junction cistern has ledges along the parent's far walkway and where
    // the branch leaves, a head cistern where the branch comes in
    const junctionLedges =
      atJunction &&
      pickLedges(random, settings.cisternLedges, [
        sideOf(parent.horizontal, 'across', outward),
        sideOf(parent.horizontal, 'across', outward === 1 ? -1 : 1),
      ]);
    const headLedges =
      cistern === 'head' &&
      pickLedges(random, settings.cisternLedges, [
        sideOf(!parent.horizontal, 'along', outward === 1 ? -1 : 1),
      ]);
    const water = start + Math.floor((along - width) / 2);
    const from = outward === 1 ? side.max + 1 : side.min - 1;
    const wanted = draw(settings.branchLength);
    const heads = headLedges
      ? [
          {
            along: Math.max(draw(settings.cisternSize), 4),
            across: Math.max(draw(settings.cisternSize), width + 4),
          },
        ]
      : random() < settings.headChance
        ? [
            {
              along: Math.max(draw(settings.chamberSize), 3),
              across: Math.max(draw(settings.chamberSize), width + 4),
            },
            undefined,
          ]
        : [undefined];
    for (const head of heads) {
      for (let length = wanted; length >= settings.branchLength.min; --length) {
        const to = from + (length - 1) * outward;
        const tunnel = { min: Math.min(from, to), max: Math.max(from, to) };
        const headAlong = head && {
          min: outward === 1 ? tunnel.max + 1 : tunnel.min - head.along,
          max: outward === 1 ? tunnel.max + head.along : tunnel.min - 1,
        };
        const headArea =
          head &&
          headAlong &&
          lineArea(!parent.horizontal, headAlong, {
            min: water - Math.floor((head.across - width) / 2),
            max:
              water - Math.floor((head.across - width) / 2) + head.across - 1,
          });
        // the water runs to the far wall of a head chamber, but only onto
        // the ledge of a head cistern, and starts on the ledge of a junction
        // cistern
        const end = headAlong
          ? (outward === 1) === !headLedges
            ? headAlong.max
            : headAlong.min
          : to;
        const near = junctionLedges
          ? outward === 1
            ? side.max
            : side.min
          : outward === 1
            ? parent.across + parent.width
            : parent.across - 1;
        const line: SewerLine = {
          horizontal: !parent.horizontal,
          level: 'branch',
          parent: index,
          outward,
          across: water,
          width,
          tunnel,
          water: { min: Math.min(near, end), max: Math.max(near, end) },
          junction,
          ...(junctionLedges && { junctionLedges }),
          ...(headArea && { head: headArea }),
          ...(headArea && headLedges && { headLedges }),
        };
        const floors = [tunnelArea(line), ...(headArea ? [headArea] : [])];
        if (fits(floors, mouthRocks(line), ids[index] as number)) {
          claim([junction]);
          lines.push(line);
          ids.push(claim([tunnelArea(line), ...mouthRocks(line)]));
          if (headArea) {
            claim([headArea]);
          }
          return true;
        }
      }
    }
    return false;
  };

  const branches = draw(settings.branches);
  let cisterns = settings.cisterns.max > 0 ? draw(settings.cisterns) : 0;
  for (let branch = 0; branch < branches; ++branch) {
    for (let tries = 0; tries < BRANCH_TRIES; ++tries) {
      // a cistern still owed takes the first half of the tries
      const cistern =
        cisterns > 0 && tries < BRANCH_TRIES / 2
          ? random() < 0.5
            ? 'junction'
            : 'head'
          : undefined;
      if (tryBranch(cistern)) {
        if (cistern) {
          --cisterns;
        }
        break;
      }
    }
  }
  return lines;
}

/**
 * The trunks to try, in order: along a way that fits the area and has as many
 * ends on the border as the outfalls drawn, or as many as any way has, with
 * its water cut down to fit, at every row (or column) it fits in, those in
 * the middle half of the area first, each lot shuffled. Throws an ordinary
 * `Error` when no way has `outfalls.min` ends on the border.
 */
function planTrunk(
  width: number,
  height: number,
  random: Random,
  settings: SewerSettings,
  borders: SewerBorders,
): SewerLine[] {
  const ways = (['horizontal', 'vertical'] as const).filter((way) => {
    const [along, across] =
      way === 'horizontal' ? [width, height] : [height, width];
    return (
      (settings.orientation === 'any' || settings.orientation === way) &&
      along >= MIN_SEWER_ALONG &&
      across >= MIN_SEWER_ACROSS
    );
  });
  // the ends of a trunk that lie on the border of the map, each way
  const endsOf = (way: (typeof ways)[number]) =>
    ([-1, 1] as const).filter((end) =>
      way === 'horizontal'
        ? end === -1
          ? borders.left
          : borders.right
        : end === -1
          ? borders.top
          : borders.bottom,
    );
  const most = Math.max(...ways.map((way) => endsOf(way).length));
  const outfalls = Math.min(
    randomInt(random, settings.outfalls.min, settings.outfalls.max),
    most,
  );
  if (outfalls < settings.outfalls.min) {
    throw new Error(
      `digSewers needs ${String(settings.outfalls.min)} outfall(s), but its area reaches the border of the map at ${String(most)} end(s) of a trunk; give it an area that spans the map, or a lower outfalls.min`,
    );
  }
  const way = pickRandom(
    random,
    ways.filter((candidate) => endsOf(candidate).length >= outfalls),
  );
  const horizontal = way === 'horizontal';
  const ends = shuffle(random, endsOf(way))
    .slice(0, outfalls)
    .sort((a, b) => a - b)
    .map((end) => ({ end, side: random() < 0.5 ? -1 : 1 }) as const);
  const reaches = (end: 1 | -1) => ends.some((outfall) => outfall.end === end);
  const [along, across] = horizontal ? [width, height] : [height, width];
  const water = Math.min(
    randomInt(random, settings.trunkWidth.min, settings.trunkWidth.max),
    across - 4,
  );
  // an outfall runs up to the border, and its water onto it when it pierces
  const tunnel = {
    min: reaches(-1) ? 1 : MOUTH_ROCK + 1,
    max: reaches(1) ? along - 2 : along - MOUTH_ROCK - 2,
  };
  const pierce = settings.pierceBorder ? 1 : 0;
  const flow = {
    min: reaches(-1) ? tunnel.min - pierce : tunnel.min,
    max: reaches(1) ? tunnel.max + pierce : tunnel.max,
  };
  const [low, high] = [2, across - 2 - water];
  const margin = Math.floor((high - low) / 4);
  const middle: number[] = [];
  const outer: number[] = [];
  for (let start = low; start <= high; ++start) {
    (start >= low + margin && start <= high - margin ? middle : outer).push(
      start,
    );
  }
  return [...shuffle(random, middle), ...shuffle(random, outer)].map(
    (start) => ({
      horizontal,
      level: 'trunk',
      outward: 1,
      across: start,
      width: water,
      tunnel,
      water: flow,
      outfalls: ends,
    }),
  );
}
