import type { Grid } from '../core/grid';
import type { Point } from '../core/point';
import type { Random } from '../core/random';
import { randomInt } from '../core/random-int';
import { Tile } from '../core/tile';
import { traceTiles } from '../roads/trace-tiles';

/** A tunnel that a crosscut may join: the tiles along its middle and its index among the passages. */
export interface CrosscutEnd {
  tiles: readonly Point[];
  passage: number;
}

/**
 * Plans a crosscut between two neighboring ribs of a fishbone, without
 * carving it: a straight tunnel of width 1 from a tile of the first rib to the
 * nearest tile of the second, so it runs the shortest way across, roughly
 * square to the ribs. It is picked at random from the stretch where the two
 * ribs run side by side: its two ends are each other's nearest tiles on the
 * two ribs, and neither is at the end of its rib. The tunnel only digs wall that
 * stays clear of every other tunnel, with a wall between (`owner` holds the
 * index of the passage that dug each tile, row by row), lies inside the
 * `margin` and is not protected. Returns undefined when nowhere fits.
 */
export function planCrosscut(
  grid: Grid,
  random: Random,
  owner: Int32Array,
  first: CrosscutEnd,
  second: CrosscutEnd,
  margin: number,
  protect?: Uint8Array,
): Point[] | undefined {
  const joined = (x: number, y: number) => {
    const by = owner[y * grid.width + x];
    return by === first.passage || by === second.passage;
  };
  const clear = ({ x, y }: Point) => {
    for (let dy = -1; dy <= 1; ++dy) {
      for (let dx = -1; dx <= 1; ++dx) {
        if (
          grid.get(x + dx, y + dy) === Tile.Floor &&
          !joined(x + dx, y + dy)
        ) {
          return false;
        }
      }
    }
    return true;
  };
  const diggable = ({ x, y }: Point) =>
    x >= margin &&
    y >= margin &&
    x < grid.width - margin &&
    y < grid.height - margin &&
    (protect?.[y * grid.width + x] ?? 0) === 0;
  const fits = (line: readonly Point[]) => {
    let walls = 0;
    for (const tile of line) {
      if (grid.get(tile.x, tile.y) === Tile.Floor) {
        if (!joined(tile.x, tile.y)) {
          return false;
        }
      } else if (!diggable(tile) || !clear(tile)) {
        return false;
      } else {
        ++walls;
      }
    }
    return walls > 0;
  };

  /** The index of the tile of `tiles` nearest to `to`, the first of those at the same distance. */
  const nearest = (tiles: readonly Point[], to: Point) => {
    let found = -1;
    let best = Infinity;
    tiles.forEach(({ x, y }, j) => {
      const distance = (x - to.x) ** 2 + (y - to.y) ** 2;
      if (distance < best) {
        best = distance;
        found = j;
      }
    });
    return found;
  };
  /** Whether the tile at `index` lies inside the tunnel, not at one of its ends. */
  const inner = (tiles: readonly Point[], index: number) =>
    index > 0 && index < tiles.length - 1;

  // The two tiles must be each other's nearest, which only happens where the
  // ribs run side by side, and gives the shortest way across.
  const lines: Point[][] = [];
  first.tiles.forEach((from, i) => {
    const j = nearest(second.tiles, from);
    const to = second.tiles[j];
    if (
      !to ||
      !inner(first.tiles, i) ||
      !inner(second.tiles, j) ||
      nearest(first.tiles, to) !== i
    ) {
      return;
    }
    const line = traceTiles(from, to);
    if (fits(line)) {
      lines.push(line);
    }
  });
  return lines.length > 0
    ? lines[randomInt(random, 0, lines.length - 1)]
    : undefined;
}
