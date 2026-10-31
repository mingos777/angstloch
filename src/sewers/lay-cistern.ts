import type { Area } from '../core/area';
import type { Random } from '../core/random';
import { randomInt } from '../core/random-int';
import type { Range } from '../core/range';
import { Tile } from '../core/tile';
import type { MapState } from '../pipeline/map-state';
import { stampTile } from '../pipeline/stamp-tile';
import type { CisternSide } from './cistern-side';

/** How the columns of the cisterns stand: the chance that a cistern has them, and the water between two of them. */
export interface CisternColumns {
  chance: number;
  spacing: Range;
}

/** Where the columns of a row stand, `pitch` apart and centered between `from` and `to`, a tile clear of each end. */
function columnsAlong(from: number, to: number, pitch: number): number[] {
  const length = to - from + 1;
  if (length < 3) {
    return [];
  }
  const count = Math.floor((length - 3) / pitch) + 1;
  const start = from + Math.floor((length - (count - 1) * pitch - 1) / 2);
  return Array.from({ length: count }, (_, index) => start + index * pitch);
}

/**
 * Turns the box of a cistern, already floor with the water of its canals
 * through it, into a basin of `ShallowWater` with a ledge of floor one tile
 * wide along each side in `ledges`. Where a canal crosses a ledge, the ledge
 * is a `Bridge`. With the chance `columns.chance`, columns of wall, a tile
 * each, stand in the basin in a grid with `columns.spacing` tiles of water
 * between them, picked once for the cistern, and none within a tile of the
 * edge of the basin or of the water of a canal running through it. Changes
 * the map in place.
 */
export function layCistern(
  state: MapState,
  random: Random,
  box: Area,
  ledges: readonly CisternSide[],
  columns: CisternColumns,
): void {
  const { grid } = state;
  const ledge = (side: CisternSide) => (ledges.includes(side) ? 1 : 0);
  const basin = {
    left: box.x + ledge('left'),
    top: box.y + ledge('top'),
    right: box.x + box.width - 1 - ledge('right'),
    bottom: box.y + box.height - 1 - ledge('bottom'),
  };
  const inBasin = (x: number, y: number) =>
    x >= basin.left && x <= basin.right && y >= basin.top && y <= basin.bottom;
  // the canals through the basin, which no column stands in or beside
  const flow = new Set<number>();
  for (let y = box.y; y < box.y + box.height; ++y) {
    for (let x = box.x; x < box.x + box.width; ++x) {
      if (grid.get(x, y) === Tile.ShallowWater) {
        if (inBasin(x, y)) {
          flow.add(y * grid.width + x);
        } else {
          stampTile(state, x, y, Tile.Bridge);
        }
      } else if (inBasin(x, y)) {
        stampTile(state, x, y, Tile.ShallowWater);
      }
    }
  }
  if (random() >= columns.chance) {
    return;
  }
  const pitch = randomInt(random, columns.spacing.min, columns.spacing.max) + 1;
  for (const y of columnsAlong(basin.top, basin.bottom, pitch)) {
    for (const x of columnsAlong(basin.left, basin.right, pitch)) {
      let clear = true;
      for (let dy = -1; dy <= 1; ++dy) {
        for (let dx = -1; dx <= 1; ++dx) {
          clear &&= !flow.has((y + dy) * grid.width + x + dx);
        }
      }
      if (clear) {
        stampTile(state, x, y, Tile.Wall);
      }
    }
  }
}
