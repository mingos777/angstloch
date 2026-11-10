import { DIRECTIONS } from '../core/directions';
import type { Point } from '../core/point';
import { Tile } from '../core/tile';
import { isFree } from '../pipeline/is-free';
import { labelPieces } from '../pipeline/label-pieces';
import type { MapState } from '../pipeline/map-state';
import { openReserved } from '../pipeline/open-reserved';
import { Reserve } from '../pipeline/reserve';
import { stampTile } from '../pipeline/stamp-tile';

/** The longest way it digs out of an entrance. */
const MAX_LENGTH = 2;

/**
 * Opens every `Openable` wall that has open ground on one side and, a short
 * straight way out on the other, open ground of another piece: the entrance of
 * a cell block that a later hall or sewer came within a tile or two of. The
 * way runs out of the wall through free rock, at most `MAX_LENGTH` tiles, and
 * ends at the first tile that touches the other piece along an edge. No
 * corridor can join such an entrance, since its tile in front is an exit of
 * the other piece too, or touches it corner to corner, so the way becomes
 * `Floor` and the wall is opened as floor with `openReserved`. Once two pieces
 * are joined, no other wall between them is opened. A wall that `skip` marks
 * with 1 is left alone. Returns the walls it opened.
 */
export function joinAcrossApproaches(
  state: Pick<MapState, 'grid' | 'base' | 'prunable' | 'reserved'>,
  skip?: Uint8Array,
): Point[] {
  const { grid, reserved } = state;
  const { width } = grid;
  let label = labelPieces(grid);
  const labelAt = (x: number, y: number): number =>
    grid.inBounds(x, y) ? (label[y * width + x] ?? 0) : 0;
  const opened: Point[] = [];
  for (let at = 0; at < width * grid.height; ++at) {
    const x = at % width;
    const y = (at - x) / width;
    if (
      reserved[at] !== Reserve.Openable ||
      skip?.[at] === 1 ||
      grid.get(x, y) !== Tile.Wall
    ) {
      continue;
    }
    const inside = (step: Point) => labelAt(x - step.x, y - step.y);
    const way = DIRECTIONS.flatMap((step): Point[][] => {
      const own = inside(step);
      if (own === 0) {
        return [];
      }
      const tiles: Point[] = [];
      for (let k = 1; k <= MAX_LENGTH; ++k) {
        const tile = { x: x + k * step.x, y: y + k * step.y };
        if (
          grid.get(tile.x, tile.y) !== Tile.Wall ||
          !isFree(state, tile.x, tile.y)
        ) {
          return [];
        }
        tiles.push(tile);
        const reaches = DIRECTIONS.some((side) => {
          if (side.x === -step.x && side.y === -step.y) {
            return false;
          }
          const other = labelAt(tile.x + side.x, tile.y + side.y);
          return other !== 0 && other !== own;
        });
        if (reaches) {
          return [tiles];
        }
      }
      return [];
    })[0];
    if (way) {
      for (const tile of way) {
        stampTile(state, tile.x, tile.y, Tile.Floor);
      }
      grid.set(x, y, Tile.Floor);
      openReserved(state, x, y);
      opened.push({ x, y });
      label = labelPieces(grid);
    }
  }
  return opened;
}
