import type { Area } from '../core/area';
import { randomInt } from '../core/random-int';
import type { Random } from '../core/random';
import type { Range } from '../core/range';
import type { AreaGravity } from './area-gravity';
import type { AreaSpec } from './area-spec';
import type { AreaWindow } from './area-window';
import { findSpotRange } from './find-spot-range';
import { isFree } from './is-free';
import { pickAreaSize } from './pick-area-size';
import type { MapState } from './map-state';

/** How many random spots are tried for each copy. */
const SPOT_ATTEMPTS = 100;

/** Whether the box and a margin of one tile round it, as far as it is on the map, is clear of the boxes and, unless `overlap`, free. */
function isClear(
  state: Pick<MapState, 'grid' | 'base' | 'prunable' | 'reserved'>,
  box: Area,
  taken: readonly Area[],
  overlap: boolean,
): boolean {
  const { width, height } = state.grid;
  const left = Math.max(0, box.x - 1);
  const top = Math.max(0, box.y - 1);
  const right = Math.min(width - 1, box.x + box.width);
  const bottom = Math.min(height - 1, box.y + box.height);
  if (
    taken.some(
      (other) =>
        left < other.x + other.width &&
        right >= other.x &&
        top < other.y + other.height &&
        bottom >= other.y,
    )
  ) {
    return false;
  }
  if (overlap) {
    return true;
  }
  for (let y = top; y <= bottom; ++y) {
    for (let x = left; x <= right; ++x) {
      if (!isFree(state, x, y)) {
        return false;
      }
    }
  }
  return true;
}

/**
 * Draws where a box of `size` starts along an axis of `limit` tiles, so that its
 * anchor falls in the window (anywhere without one). On a `lattice` the start is
 * even, and when the window holds no even start, the box may go one tile off
 * the window's edge.
 */
function pickSpot(
  random: Random,
  window: AreaWindow<string> | undefined,
  size: number,
  limit: number,
  lattice: boolean,
): number {
  const spots = findSpotRange(window, size, limit);
  if (!lattice) {
    return randomInt(random, spots.min, spots.max);
  }
  let first = Math.ceil(spots.min / 2) * 2;
  let last = Math.floor(spots.max / 2) * 2;
  if (first > last) {
    first = Math.ceil(Math.max(0, spots.min - 1) / 2) * 2;
    last = Math.floor(Math.min(limit - size, spots.max + 1) / 2) * 2;
  }
  return first + randomInt(random, 0, (last - first) / 2) * 2;
}

/** Where gravity pulls a box of `size` along an axis of `limit` tiles: flush to the start or the end, or centered; on a `lattice` an even coordinate. */
function findPullTarget(
  side: 'start' | 'end' | 'center',
  size: number,
  limit: number,
  lattice: boolean,
): number {
  const target =
    side === 'start'
      ? 0
      : side === 'end'
        ? limit - size
        : Math.round((limit - size) / 2);
  return lattice ? Math.floor(target / 2) * 2 : target;
}

/**
 * Slides a box from where it was drawn toward the target of `gravity`, by
 * `strength` of the way on each axis. It moves one tile at a time (two on a
 * `lattice`), the axes in turn, and an axis stops for good at the first step
 * that would leave the box not clear (see `isClear`).
 */
function slide(
  state: Pick<MapState, 'grid' | 'base' | 'prunable' | 'reserved'>,
  box: Area,
  gravity: AreaGravity,
  taken: readonly Area[],
  overlap: boolean,
  lattice: boolean,
): Area {
  const { width, height } = state.grid;
  const words = gravity.toward.split(' ');
  const sideOf = (start: string, end: string): 'start' | 'end' | 'center' =>
    words.includes(start) ? 'start' : words.includes(end) ? 'end' : 'center';
  const unit = lattice ? 2 : 1;
  const moves = (
    [
      ['x', findPullTarget(sideOf('left', 'right'), box.width, width, lattice)],
      [
        'y',
        findPullTarget(sideOf('top', 'bottom'), box.height, height, lattice),
      ],
    ] as const
  ).map(([axis, target]) => {
    const distance = target - box[axis];
    return {
      axis,
      step: Math.sign(distance) * unit,
      left: Math.round((gravity.strength * Math.abs(distance)) / unit),
    };
  });
  let current = box;
  while (moves.some((move) => move.left > 0)) {
    for (const move of moves) {
      if (move.left === 0) {
        continue;
      }
      const next = { ...current, [move.axis]: current[move.axis] + move.step };
      if (isClear(state, next, taken, overlap)) {
        current = next;
        move.left -= 1;
      } else {
        move.left = 0;
      }
    }
  }
  return current;
}

/**
 * Picks the boxes a feature step builds in, one for each copy: `count` is drawn
 * from its range, and each box gets a size from `area` (the size of the map for
 * a missing range). A box as big as the map is the whole map, as it is. Any
 * other goes on a random spot where every tile of the box and of a margin of one
 * tile round it is free (see `isFree`), and which is clear of the boxes picked
 * before, so that copies never touch. On a `lattice` a box has odd sizes and
 * starts on even coordinates, so that a maze or lattice rooms line up with the
 * map's lattice. With `overlap`, a spot need only be clear of the other boxes,
 * so the box may cover anything. A window (`area.x`, `area.y`) limits the spots
 * to those where the anchor of the box falls in it; on a lattice the box may end
 * one tile off the window's edge. With `area.gravity`, the box then slides
 * toward a side, a corner or the middle, and stops where it would no longer be
 * clear (see `slide`), so copies pile up against each other. A copy that finds no spot in 100 tries throws an ordinary
 * `Error`, which `pipeline` answers with a new map. Check the options with
 * `assertAreaSpec` first.
 */
export function placeAreas(
  state: Pick<MapState, 'grid' | 'base' | 'prunable' | 'reserved'>,
  random: Random,
  area: AreaSpec,
  count: Range,
  {
    lattice = false,
    overlap = false,
  }: { lattice?: boolean; overlap?: boolean } = {},
): Area[] {
  const { width, height } = state.grid;
  const copies = randomInt(random, count.min, count.max);
  const boxes: Area[] = [];
  for (let copy = 0; copy < copies; ++copy) {
    const boxWidth = pickAreaSize(random, area.width, width, lattice);
    const boxHeight = pickAreaSize(random, area.height, height, lattice);
    if (boxWidth >= width && boxHeight >= height) {
      boxes.push({ x: 0, y: 0, width, height });
      continue;
    }
    let found: Area | undefined;
    for (let attempt = 0; attempt < SPOT_ATTEMPTS && !found; ++attempt) {
      const box = {
        x: pickSpot(random, area.x, boxWidth, width, lattice),
        y: pickSpot(random, area.y, boxHeight, height, lattice),
        width: boxWidth,
        height: boxHeight,
      };
      if (isClear(state, box, boxes, overlap)) {
        found = box;
      }
    }
    if (!found) {
      throw new Error(
        `No free spot for an area of ${String(boxWidth)} by ${String(boxHeight)} tiles on a ${String(width)} by ${String(height)} map after ${String(SPOT_ATTEMPTS)} tries (copy ${String(copy + 1)} of ${String(copies)}). The rest of the map is too crowded: make the area smaller, ask for fewer copies, or run this step before the ones that fill the map.`,
      );
    }
    boxes.push(
      area.gravity
        ? slide(state, found, area.gravity, boxes, overlap, lattice)
        : found,
    );
  }
  return boxes;
}
