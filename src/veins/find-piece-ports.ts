import { DIRECTIONS } from '../core/directions';
import type { Grid } from '../core/grid';
import type { Point } from '../core/point';
import { Tile } from '../core/tile';
import { Reserve } from '../pipeline/reserve';
import { MARGIN } from './dig-vein';

/** A tile where a vein may join a piece. */
export interface PiecePort extends Point {
  /** Whether the tile is an `Openable` tile in the wall of a room, which the vein has to open, and not a floor tile of the piece. */
  door: boolean;
}

/**
 * Finds the ports of a piece, among the tiles it is made of. A free floor tile
 * with free rock next to it, along an edge, is a port. So is an `Openable`
 * tile next to the piece with free rock beyond it, which is how a vein enters
 * a room. Only rock that `outside` marks counts (see `findOutsideRock`), so no
 * port leads into a pillar, and the outer rings of the map that stay wall are
 * left out.
 */
export function findPiecePorts(
  grid: Grid,
  reserved: Uint8Array,
  floor: readonly Point[],
  outside: Uint8Array,
): PiecePort[] {
  const { width, height } = grid;
  const open = (x: number, y: number) =>
    x > MARGIN &&
    y > MARGIN &&
    x < width - 1 - MARGIN &&
    y < height - 1 - MARGIN &&
    grid.get(x, y) === Tile.Wall &&
    reserved[y * width + x] === Reserve.None &&
    outside[y * width + x] === 1;
  const ports = new Map<number, PiecePort>();
  for (const { x, y } of floor) {
    for (const step of DIRECTIONS) {
      const [nx, ny] = [x + step.x, y + step.y];
      if (open(nx, ny)) {
        ports.set(y * width + x, { x, y, door: false });
      } else if (
        grid.inBounds(nx, ny) &&
        grid.get(nx, ny) === Tile.Wall &&
        reserved[ny * width + nx] === Reserve.Openable &&
        open(nx + step.x, ny + step.y)
      ) {
        ports.set(ny * width + nx, { x: nx, y: ny, door: true });
      }
    }
  }
  return [...ports.values()];
}
