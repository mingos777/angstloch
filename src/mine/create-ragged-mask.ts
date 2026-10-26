import type { Random } from '../core/random';
import { randomInt } from '../core/random-int';

/** The deepest that a side is cut back, however large the shape, so that a big hall has a jagged edge and not a ragged one. */
export const MAX_RAGGED_DEPTH = 4;

/** A random walk of whole numbers from 0 to `max`, one per step, that moves by 1 at most. */
function walk(random: Random, length: number, max: number): number[] {
  const values: number[] = [];
  let value = randomInt(random, 0, max);
  for (let i = 0; i < length; ++i) {
    const roll = random();
    value = Math.min(
      max,
      Math.max(0, value + (roll < 1 / 3 ? -1 : roll < 2 / 3 ? 1 : 0)),
    );
    values.push(value);
  }
  return values;
}

/** The most that a side of the given length is cut back at a `ragged` of 0 to 1: up to `MAX_RAGGED_DEPTH`, and never more than leaves a tile of the shape. */
export function raggedDepth(size: number, ragged: number): number {
  return Math.floor(
    ragged * Math.min(MAX_RAGGED_DEPTH, Math.floor((size - 1) / 2)) + 0.5,
  );
}

/**
 * Makes the shape of a rectangle with jagged edges: a mask of `width` by
 * `height` tiles, row by row, that holds 1 for a tile that is part of the
 * shape. Each of the four sides is cut back by a random amount that changes by
 * at most a tile from one tile to the next, up to a depth that `raggedDepth` gives. At 0 the shape is the whole rectangle. Only the largest group
 * of tiles that touch along edges is kept, so the shape is in one piece.
 */
export function createRaggedMask(
  random: Random,
  width: number,
  height: number,
  ragged: number,
): Uint8Array {
  const limit = (size: number) => raggedDepth(size, ragged);
  const left = walk(random, height, limit(width));
  const right = walk(random, height, limit(width));
  const top = walk(random, width, limit(height));
  const bottom = walk(random, width, limit(height));
  const mask = new Uint8Array(width * height);
  for (let y = 0; y < height; ++y) {
    for (let x = 0; x < width; ++x) {
      if (
        x >= (left[y] ?? 0) &&
        x < width - (right[y] ?? 0) &&
        y >= (top[x] ?? 0) &&
        y < height - (bottom[x] ?? 0)
      ) {
        mask[y * width + x] = 1;
      }
    }
  }
  return keepLargestGroup(mask, width, height);
}

/** Clears every tile that is not in the largest group of tiles that touch along edges. */
function keepLargestGroup(
  mask: Uint8Array,
  width: number,
  height: number,
): Uint8Array {
  const group = new Int32Array(width * height).fill(-1);
  const sizes: number[] = [];
  for (let start = 0; start < mask.length; ++start) {
    if (mask[start] !== 1 || group[start] !== -1) {
      continue;
    }
    const id = sizes.length;
    let size = 0;
    const stack = [start];
    group[start] = id;
    for (let at = stack.pop(); at !== undefined; at = stack.pop()) {
      ++size;
      const x = at % width;
      const y = Math.floor(at / width);
      for (const [nx, ny] of [
        [x - 1, y],
        [x + 1, y],
        [x, y - 1],
        [x, y + 1],
      ] as const) {
        const next = ny * width + nx;
        if (
          nx >= 0 &&
          ny >= 0 &&
          nx < width &&
          ny < height &&
          mask[next] === 1 &&
          group[next] === -1
        ) {
          group[next] = id;
          stack.push(next);
        }
      }
    }
    sizes.push(size);
  }
  const largest = sizes.indexOf(Math.max(...sizes));
  return mask.map((value, i) => (value === 1 && group[i] === largest ? 1 : 0));
}
