import type { Grid } from '../core/grid';
import { Tile } from '../core/tile';

/** How many times the vein is looked over, since a mend may make a new touch. */
const PASSES = 4;

/**
 * Mends the places where the tiles a vein `carved`, as indexes into the grid,
 * touch other open ground corner to corner only, with wall on both tiles
 * between, which would let a walker slip past the corner. A carved tile off
 * the vein's middle `line` goes back to wall; otherwise one of the two tiles
 * between is dug, so that the touch becomes an edge, where it is wall that
 * lies `margin` tiles in from the edge of the map and that `protect` does not
 * mark. Changes the grid and `carved` in place. Returns whether every touch is
 * mended; when not, the caller undoes the vein.
 */
export function mendCornerTouches(
  grid: Grid,
  carved: number[],
  line: ReadonlySet<number>,
  margin: number,
  protect?: Uint8Array,
): boolean {
  const { width, height } = grid;
  const open = (x: number, y: number) =>
    grid.inBounds(x, y) && grid.get(x, y) !== Tile.Wall;
  const diggable = (x: number, y: number) =>
    x >= margin &&
    y >= margin &&
    x < width - margin &&
    y < height - margin &&
    grid.get(x, y) === Tile.Wall &&
    (protect?.[y * width + x] ?? 0) === 0;
  for (let pass = 0; pass < PASSES; ++pass) {
    let touched = false;
    for (const at of [...carved]) {
      const x = at % width;
      const y = (at - x) / width;
      if (!open(x, y)) {
        continue;
      }
      for (const [dx, dy] of [
        [1, 1],
        [1, -1],
        [-1, 1],
        [-1, -1],
      ] as const) {
        if (!open(x + dx, y + dy) || open(x + dx, y) || open(x, y + dy)) {
          continue;
        }
        touched = true;
        if (!line.has(at)) {
          grid.set(x, y, Tile.Wall);
          carved.splice(carved.indexOf(at), 1);
          break;
        }
        const between = [
          [x + dx, y],
          [x, y + dy],
        ].find(([bx = 0, by = 0]) => diggable(bx, by));
        if (!between) {
          return false;
        }
        const [bx = 0, by = 0] = between;
        grid.set(bx, by, Tile.Floor);
        carved.push(by * width + bx);
      }
    }
    if (!touched) {
      return true;
    }
  }
  return false;
}
