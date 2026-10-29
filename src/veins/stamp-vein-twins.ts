import type { Point } from '../core/point';
import { Tile } from '../core/tile';
import { openReserved } from '../pipeline/open-reserved';
import type { MapState } from '../pipeline/map-state';
import { Reserve } from '../pipeline/reserve';
import type { Transform } from '../rooms/templates/create-transforms';
import { MARGIN } from './dig-vein';
import type { MinePassage } from './mine-passage';

/**
 * Digs the twins of a vein, in place: every tile it carved becomes floor at
 * each of its images, and each opened door gets its twins opened where the
 * images are `Openable`. A twin tile is left out when it is not free rock that
 * a vein can reach (`outside` marks that), so a pillar, a room or the margin
 * stays as it is. Returns the twins of the passage and the number of tiles
 * dug.
 */
export function stampVeinTwins(
  state: Pick<MapState, 'grid' | 'reserved'>,
  images: readonly Transform[],
  outside: Uint8Array,
  vein: { passage: MinePassage; carved: readonly number[] },
  doors: readonly Point[],
): { passages: MinePassage[]; dug: number } {
  const { grid, reserved } = state;
  const { width, height } = grid;
  let dug = 0;
  for (const tile of vein.carved) {
    for (const { point } of images) {
      const { x, y } = point({ x: tile % width, y: Math.floor(tile / width) });
      const at = y * width + x;
      if (
        x >= MARGIN &&
        y >= MARGIN &&
        x < width - MARGIN &&
        y < height - MARGIN &&
        grid.get(x, y) === Tile.Wall &&
        reserved[at] === Reserve.None &&
        outside[at] === 1
      ) {
        grid.set(x, y, Tile.Floor);
        dug += 1;
      }
    }
  }
  for (const { point } of images) {
    for (const door of doors) {
      const { x, y } = point(door);
      if (reserved[y * width + x] === Reserve.Openable) {
        grid.set(x, y, Tile.Floor);
        openReserved(state, x, y);
      }
    }
  }
  return {
    passages: images.map(({ point }) => ({
      ...vein.passage,
      tiles: vein.passage.tiles.map(point),
    })),
    dug,
  };
}
