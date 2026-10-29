import type { Area } from '../core/area';
import { randomInt } from '../core/random-int';
import type { Random } from '../core/random';
import type { Range } from '../core/range';
import type { AreaSize } from './area-size';
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
 * Picks the boxes a feature step builds in, one for each copy: `count` is drawn
 * from its range, and each box gets a size from `area` (the size of the map for
 * a missing range). A box as big as the map is the whole map, as it is. Any
 * other goes on a random spot where every tile of the box and of a margin of one
 * tile round it is free (see `isFree`), and which is clear of the boxes picked
 * before, so that copies never touch. On a `lattice` a box has odd sizes and
 * starts on even coordinates, so that a maze or lattice rooms line up with the
 * map's lattice. With `overlap`, a spot need only be clear of the other boxes,
 * so the box may cover anything. A copy that finds no spot in 100 tries throws an ordinary
 * `Error`, which `pipeline` answers with a new map. Check the options with
 * `assertAreaSize` first.
 */
export function placeAreas(
  state: Pick<MapState, 'grid' | 'base' | 'prunable' | 'reserved'>,
  random: Random,
  area: AreaSize,
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
    const step = lattice ? 2 : 1;
    const spotsX = Math.floor((width - boxWidth) / step);
    const spotsY = Math.floor((height - boxHeight) / step);
    let found: Area | undefined;
    for (let attempt = 0; attempt < SPOT_ATTEMPTS && !found; ++attempt) {
      const box = {
        x: randomInt(random, 0, spotsX) * step,
        y: randomInt(random, 0, spotsY) * step,
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
    boxes.push(found);
  }
  return boxes;
}
