import type { Area } from '../core/area';
import { randomInt } from '../core/random-int';
import type { Random } from '../core/random';
import type { AreaGravity } from './area-gravity';
import type { AreaSpec } from './area-spec';
import type { AreaWindow } from './area-window';
import { findSpotRange } from './find-spot-range';
import { isFree } from './is-free';
import type { MapState } from './map-state';
import type { PlaceAreaSettings } from './place-area-settings';

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
 * where the box no longer `fits`.
 */
function slide(
  { width, height }: { width: number; height: number },
  box: Area,
  gravity: AreaGravity,
  fits: (box: Area) => boolean,
  lattice: boolean,
): Area {
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
      if (fits(next)) {
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
 * Finds a spot for one box of `size`, as `placeAreas` does for each copy: a box
 * as big as the map is the whole map, if accepted; any other is drawn at up to
 * 100 random spots in the window of `area`, clear of the `taken` boxes (and,
 * unless `overlap`, on free tiles), accepted by `accepts`, then slid by
 * `area.gravity`. Returns `undefined` when no spot is found, and leaves the
 * failing to the caller.
 */
export function placeArea(
  state: Pick<MapState, 'grid' | 'base' | 'prunable' | 'reserved'>,
  random: Random,
  size: { width: number; height: number },
  area: AreaSpec,
  taken: readonly Area[],
  { lattice = false, overlap = false, accepts }: PlaceAreaSettings = {},
): Area | undefined {
  const { width, height } = state.grid;
  const fits = (box: Area): boolean =>
    isClear(state, box, taken, overlap) && (accepts?.(box) ?? true);
  if (size.width >= width && size.height >= height) {
    const whole = { x: 0, y: 0, width, height };
    return accepts && !accepts(whole) ? undefined : whole;
  }
  for (let attempt = 0; attempt < SPOT_ATTEMPTS; ++attempt) {
    const box = {
      x: pickSpot(random, area.x, size.width, width, lattice),
      y: pickSpot(random, area.y, size.height, height, lattice),
      ...size,
    };
    if (fits(box)) {
      return area.gravity
        ? slide(state.grid, box, area.gravity, fits, lattice)
        : box;
    }
  }
  return undefined;
}
