import type { Grid } from '../core/grid';
import { Tile } from '../core/tile';

/** The eight tiles around a tile, in order round it. */
const RING = [
  { x: -1, y: -1 },
  { x: 0, y: -1 },
  { x: 1, y: -1 },
  { x: 1, y: 0 },
  { x: 1, y: 1 },
  { x: 0, y: 1 },
  { x: -1, y: 1 },
  { x: -1, y: 0 },
] as const;

/** How many times the grid is swept at most; a sweep only digs, so a few always settle it. */
const MAX_SWEEPS = 8;

/**
 * Digs out the corner gaps where two tunnels meet: a 2 by 2 block with floor
 * on one diagonal and wall on the other, where a walker who moves diagonally
 * slips between two walls that touch at a corner only, such as the tip of
 * the wedge of rock where an adit forks off the shaft. Of the two walls, the
 * one with fewer walls around it is dug. Unless `allowLoops` is set, a wall
 * is dug only where that keeps the rock around it in one piece, which a tip
 * does, so digging never opens a loop round a piece of rock it cuts off, and
 * a gap where neither wall can go is left as it is. Only
 * gaps between two tiles that `isOurs` accepts are dug, and only walls that
 * `canDig` allows. Calls `onCarve` for every tile that became floor, and
 * returns how many there were.
 */
export function carveCornerGaps(
  grid: Grid,
  isOurs: (x: number, y: number) => boolean,
  canDig: (x: number, y: number) => boolean,
  onCarve?: (x: number, y: number) => void,
  allowLoops = false,
): number {
  const wall = (x: number, y: number) => grid.get(x, y) === Tile.Wall;
  const floor = (x: number, y: number) =>
    grid.get(x, y) === Tile.Floor && isOurs(x, y);
  const walls = (x: number, y: number) => {
    let count = 0;
    for (let dy = -1; dy <= 1; ++dy) {
      for (let dx = -1; dx <= 1; ++dx) {
        count += (dx !== 0 || dy !== 0) && wall(x + dx, y + dy) ? 1 : 0;
      }
    }
    return count;
  };
  /**
   * Whether the walls around the tile form one unbroken run, going round it,
   * so that taking the tile out leaves them joined to each other.
   */
  const keepsRockWhole = (x: number, y: number) => {
    let runs = 0;
    RING.forEach((offset, i) => {
      const next = RING[(i + 1) % RING.length] ?? offset;
      if (wall(x + offset.x, y + offset.y) && !wall(x + next.x, y + next.y)) {
        ++runs;
      }
    });
    return runs <= 1;
  };
  /** Digs the wall of the two with fewer walls around it that may be dug, and says whether it dug one. */
  const dig = (ax: number, ay: number, bx: number, by: number): boolean => {
    const options = [
      { x: ax, y: ay },
      { x: bx, y: by },
    ]
      .filter(
        ({ x, y }) => canDig(x, y) && (allowLoops || keepsRockWhole(x, y)),
      )
      .sort((p, q) => walls(p.x, p.y) - walls(q.x, q.y));
    const [best] = options;
    if (!best) {
      return false;
    }
    grid.set(best.x, best.y, Tile.Floor);
    onCarve?.(best.x, best.y);
    return true;
  };

  let carved = 0;
  for (let sweep = 0, dug = true; dug && sweep < MAX_SWEEPS; ++sweep) {
    dug = false;
    for (let y = 0; y < grid.height - 1; ++y) {
      for (let x = 0; x < grid.width - 1; ++x) {
        const gap =
          floor(x, y) && floor(x + 1, y + 1) && wall(x + 1, y) && wall(x, y + 1)
            ? dig(x + 1, y, x, y + 1)
            : floor(x + 1, y) &&
              floor(x, y + 1) &&
              wall(x, y) &&
              wall(x + 1, y + 1) &&
              dig(x, y, x + 1, y + 1);
        if (gap) {
          ++carved;
          dug = true;
        }
      }
    }
  }
  return carved;
}
