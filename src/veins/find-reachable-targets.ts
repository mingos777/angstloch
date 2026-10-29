import { DIRECTIONS } from '../core/directions';
import type { Grid } from '../core/grid';
import type { Point } from '../core/point';
import { Tile } from '../core/tile';
import { Reserve } from '../pipeline/reserve';
import { MARGIN } from './dig-vein';

/**
 * Returns the targets that a vein can reach from some tiles, through free rock
 * only: the targets that have a tile of rock next to them that a flood of rock
 * from the starting tiles reaches. A vein is routed over free rock alone, so a
 * target behind a band of floor that is not in the way of rock is out of reach,
 * however near it lies.
 */
export function findReachableTargets<T extends Point>(
  grid: Grid,
  reserved: Uint8Array,
  from: readonly Point[],
  targets: readonly T[],
): T[] {
  const { width, height } = grid;
  const free = (x: number, y: number) =>
    x > MARGIN &&
    y > MARGIN &&
    x < width - 1 - MARGIN &&
    y < height - 1 - MARGIN &&
    grid.get(x, y) === Tile.Wall &&
    reserved[y * width + x] === Reserve.None;
  const reached = new Uint8Array(width * height);
  const queue: number[] = [];
  const visit = (x: number, y: number) => {
    if (free(x, y) && reached[y * width + x] === 0) {
      reached[y * width + x] = 1;
      queue.push(y * width + x);
    }
  };
  for (const { x, y } of from) {
    for (const step of DIRECTIONS) {
      visit(x + step.x, y + step.y);
    }
  }
  for (let head = 0; head < queue.length; ++head) {
    const at = queue[head] as number;
    const x = at % width;
    const y = (at - x) / width;
    for (const step of DIRECTIONS) {
      visit(x + step.x, y + step.y);
    }
  }
  return targets.filter(({ x, y }) =>
    DIRECTIONS.some(
      (step) =>
        grid.inBounds(x + step.x, y + step.y) &&
        reached[(y + step.y) * width + x + step.x] === 1,
    ),
  );
}
