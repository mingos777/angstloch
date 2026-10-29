import type { Area } from '../core/area';
import { DIRECTIONS } from '../core/directions';
import type { Point } from '../core/point';
import { randomInt } from '../core/random-int';
import type { Random } from '../core/random';
import { isFree } from './is-free';
import type { MapState } from './map-state';

/** How many random spots are tried for a shape. */
const SPOT_ATTEMPTS = 100;

/**
 * How far every tile is from the nearest dug tile, one that holds something
 * other than the base, going by steps along edges. Every tile is at `Infinity`
 * on a map with nothing dug.
 */
function measureDugDistance(
  state: Pick<MapState, 'grid' | 'base'>,
): Float64Array {
  const { grid, base } = state;
  const { width, height } = grid;
  const distance = new Float64Array(width * height).fill(Infinity);
  const queue: number[] = [];
  for (let y = 0; y < height; ++y) {
    for (let x = 0; x < width; ++x) {
      if (grid.get(x, y) !== base) {
        distance[y * width + x] = 0;
        queue.push(y * width + x);
      }
    }
  }
  for (let head = 0; head < queue.length; ++head) {
    const at = queue[head] ?? 0;
    const x = at % width;
    const y = Math.floor(at / width);
    for (const step of DIRECTIONS) {
      const next = (y + step.y) * width + x + step.x;
      if (
        grid.inBounds(x + step.x, y + step.y) &&
        distance[next] === Infinity
      ) {
        distance[next] = (distance[at] ?? 0) + 1;
        queue.push(next);
      }
    }
  }
  return distance;
}

/**
 * Picks a spot for a shape of the given size, whose `floor` tiles are listed in
 * its own coordinates: up to 100 random spots on the map are tried, and a spot
 * fits when every floor tile and the 8 tiles round it, as far as they are on
 * the map, are free (see `isFree`), so the shape's floor never touches what is
 * there while its box may. Of the spots that fit, the one whose floor comes
 * nearest the dug ground (tiles other than the base) wins; on a map with
 * nothing dug, the first that fits. Returns the box at that spot, or
 * `undefined` when none fits.
 */
export function placeBeside(
  state: Pick<MapState, 'grid' | 'base' | 'prunable' | 'reserved'>,
  random: Random,
  size: { width: number; height: number },
  floor: readonly Point[],
): Area | undefined {
  const { width, height } = state.grid;
  const distance = measureDugDistance(state);
  let best: { box: Area; gap: number } | undefined;
  for (let attempt = 0; attempt < SPOT_ATTEMPTS; ++attempt) {
    const box = {
      x: randomInt(random, 0, Math.max(0, width - size.width)),
      y: randomInt(random, 0, Math.max(0, height - size.height)),
      width: size.width,
      height: size.height,
    };
    let gap = Infinity;
    const fits = floor.every((tile) => {
      const x = box.x + tile.x;
      const y = box.y + tile.y;
      gap = Math.min(gap, distance[y * width + x] ?? Infinity);
      for (let dy = -1; dy <= 1; ++dy) {
        for (let dx = -1; dx <= 1; ++dx) {
          if (
            state.grid.inBounds(x + dx, y + dy) &&
            !isFree(state, x + dx, y + dy)
          ) {
            return false;
          }
        }
      }
      return true;
    });
    if (fits && (!best || gap < best.gap)) {
      best = { box, gap };
    }
  }
  return best?.box;
}
