import type { Grid } from '../core/grid';
import type { Point } from '../core/point';
import { Tile } from '../core/tile';
import type { NoiseFunction } from '../noise/noise-function';
import { carvePassageTiles } from './carve-passage-tiles';
import { MARGIN } from './dig-vein';
import { mendCornerTouches } from './mend-corner-touches';
import { findRockRoute } from './find-rock-route';
import type { MinePassage } from './mine-passage';
import { wobbleRoute } from './wobble-route';

/** How many times as long as the distance between its ends, along the grid, a vein may be. */
const DETOUR_FACTOR = 1.5;
/** How many tiles are added to that, so that a vein between close ends has some room to go round. */
const DETOUR_SLACK = 8;

/**
 * Marks the tiles a vein may not use: the border, the tiles that `protect`
 * marks, and everything within `clearance` tiles of floor, so that a wall is
 * left between the vein and the rest of the mine. Around each of the entrances
 * the floor does not count, since that is where the vein has to leave.
 */
function blockTiles(
  grid: Grid,
  clearance: number,
  entrances: readonly Point[],
  protect?: Uint8Array,
): Uint8Array {
  const { width, height } = grid;
  const blocked = new Uint8Array(width * height);
  for (let y = 0; y < height; ++y) {
    for (let x = 0; x < width; ++x) {
      if (
        x <= MARGIN ||
        y <= MARGIN ||
        x >= width - 1 - MARGIN ||
        y >= height - 1 - MARGIN ||
        (protect?.[y * width + x] ?? 0) !== 0
      ) {
        blocked[y * width + x] = 1;
      }
    }
  }
  for (let y = 0; y < height; ++y) {
    for (let x = 0; x < width; ++x) {
      if (grid.get(x, y) === Tile.Wall) {
        continue;
      }
      for (let dy = -clearance; dy <= clearance; ++dy) {
        for (let dx = -clearance; dx <= clearance; ++dx) {
          const nx = x + dx;
          const ny = y + dy;
          if (nx >= 0 && ny >= 0 && nx < width && ny < height) {
            blocked[ny * width + nx] = 1;
          }
        }
      }
    }
  }
  for (const entrance of entrances) {
    for (let dy = -clearance; dy <= clearance; ++dy) {
      for (let dx = -clearance; dx <= clearance; ++dx) {
        const x = entrance.x + dx;
        const y = entrance.y + dy;
        if (
          x > MARGIN &&
          y > MARGIN &&
          x < width - 1 - MARGIN &&
          y < height - 1 - MARGIN &&
          grid.get(x, y) === Tile.Wall &&
          (protect?.[y * width + x] ?? 0) === 0
        ) {
          blocked[y * width + x] = 0;
        }
      }
    }
  }
  return blocked;
}

/** The free tiles next to an entrance, along an edge, nearest to `towards` first, where a vein may leave it. */
function findMouths(
  grid: Grid,
  blocked: Uint8Array,
  entrance: Point,
  towards: Point,
): Point[] {
  const mouths: Point[] = [];
  for (const [dx, dy] of [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ] as const) {
    const x = entrance.x + dx;
    const y = entrance.y + dy;
    if (
      grid.inBounds(x, y) &&
      grid.get(x, y) === Tile.Wall &&
      blocked[y * grid.width + x] !== 1
    ) {
      mouths.push({ x, y });
    }
  }
  return mouths.sort(
    (a, b) =>
      Math.hypot(towards.x - a.x, towards.y - a.y) -
      Math.hypot(towards.x - b.x, towards.y - b.y),
  );
}

/**
 * Digs a vein between two entrances on the boundaries of halls, through the
 * rock between them. A route is found over the rock that keeps a wall's
 * thickness from every hall and every earlier vein, so the vein runs around
 * the halls and never across one, and then it is given a natural look and
 * carved. A vein that would be much longer than the distance between its ends,
 * along the grid, is not dug: there is no route then. A vein never runs over
 * a tile that `protect` marks with anything but a 0. Where it would touch
 * other floor corner to corner only, which would let a walker slip past the
 * corner, it is mended (see `mendCornerTouches`), and a vein that cannot be
 * is not dug: there is no route then. `relaxed` is a last
 * resort for ends that are boxed in: only floor blocks the route, there is no
 * limit to its length, and veins may run close to the halls and to each other.
 * Returns the vein and the tiles of floor it made, as indexes into the grid,
 * or nothing when there is no route.
 */
export function digRoutedVein(
  grid: Grid,
  noise: NoiseFunction,
  from: Point,
  to: Point,
  style: { width: number; windiness: number; protect?: Uint8Array },
  lane: number,
  relaxed = false,
): { passage: MinePassage; carved: number[] } | undefined {
  // a passage reaches half its width from its middle line, and one wall is left beyond that
  const clearance = relaxed ? 0 : Math.floor(style.width / 2) + 1;
  const blocked = blockTiles(grid, clearance, [from, to], style.protect);
  const limit = relaxed
    ? Infinity
    : Math.floor(
        DETOUR_FACTOR * (Math.abs(to.x - from.x) + Math.abs(to.y - from.y)) +
          DETOUR_SLACK,
      );
  // the nearest mouths first; one that is walled off from the other end is skipped
  let route: Point[] | undefined;
  for (const start of findMouths(grid, blocked, from, to)) {
    for (const end of findMouths(grid, blocked, to, from)) {
      route ??= findRockRoute(
        grid.width,
        grid.height,
        blocked,
        start,
        end,
        limit,
      );
    }
  }
  if (!route) {
    return undefined;
  }
  const tiles = [
    from,
    ...wobbleRoute(
      route,
      grid.width,
      grid.height,
      blocked,
      noise,
      style.windiness,
      lane,
    ),
    to,
  ];
  const carved: number[] = [];
  carvePassageTiles(
    grid,
    tiles,
    style.width,
    MARGIN,
    (x, y) => {
      carved.push(y * grid.width + x);
    },
    style.protect,
  );
  const line = new Set(tiles.map(({ x, y }) => y * grid.width + x));
  if (!mendCornerTouches(grid, carved, line, MARGIN, style.protect)) {
    for (const at of carved) {
      grid.set(at % grid.width, Math.floor(at / grid.width), Tile.Wall);
    }
    return undefined;
  }
  return { passage: { kind: 'vein', tiles, width: style.width }, carved };
}
