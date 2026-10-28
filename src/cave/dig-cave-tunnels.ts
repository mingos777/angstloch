import { assertFraction } from '../core/assert-fraction';
import { assertLayoutSymmetry } from '../core/assert-layout-symmetry';
import { assertWholeNumber } from '../core/assert-whole-number';
import { Tile } from '../core/tile';
import { assertWallBase } from '../pipeline/assert-wall-base';
import { isFree } from '../pipeline/is-free';
import type { MapStep } from '../pipeline/map-step';
import { Reserve } from '../pipeline/reserve';
import { stampTile } from '../pipeline/stamp-tile';
import { step } from '../pipeline/step';
import { connectCaves } from './connect-caves';
import type { DigCaveTunnelsOptions } from './dig-cave-tunnels-options';

/**
 * A step that joins every piece of floor on the map into one by digging
 * tunnels through rock, whatever made the floor: caverns, a mine, the halls of
 * another step. The largest piece is joined to its nearest neighbor first, and
 * the group keeps growing that way, so every tunnel is as short as it can be.
 * `loops` adds shortcuts on top.
 *
 * Tunnels dig only through free tiles and pass along existing floor. They
 * never touch a reserved tile, so a room's floor is not a piece they join, and
 * a piece that only a reserved tile could reach is left as it is. The map has
 * to start as wall, which `pipeline` checks before the first attempt. Throws a
 * `RangeError` at once for a bad option.
 */
export function digCaveTunnels(options: DigCaveTunnelsOptions = {}): MapStep {
  const {
    style = 'winding',
    width = 1,
    windiness = 0.5,
    loops = 0,
    borderWalls = true,
    symmetry = 'none',
    symmetryChance = 1,
  } = options;
  // widened, since the styles may be added to
  const named: string = style;
  if (named !== 'winding' && named !== 'direct') {
    throw new RangeError(`style must be 'winding' or 'direct', got ${named}`);
  }
  assertWholeNumber('width', width, 1);
  assertFraction('windiness', windiness);
  assertFraction('loops', loops);
  assertLayoutSymmetry('symmetry', symmetry);
  assertFraction('symmetryChance', symmetryChance);

  return step(
    'digCaveTunnels',
    {
      validate: (state) => {
        assertWallBase('digCaveTunnels', state);
      },
    },
    (state, { random }) => {
      const { grid, reserved } = state;
      // tunnels are dug on a copy without the floor of reserved tiles, so
      // that a room is not a piece to join
      const view = grid.clone();
      const blocked = new Uint8Array(grid.width * grid.height);
      for (let y = 0; y < grid.height; ++y) {
        for (let x = 0; x < grid.width; ++x) {
          const at = y * grid.width + x;
          const ring =
            x === 0 || y === 0 || x === grid.width - 1 || y === grid.height - 1;
          if (reserved[at] !== Reserve.None) {
            view.set(x, y, Tile.Wall);
          }
          blocked[at] =
            reserved[at] !== Reserve.None ||
            (borderWalls && ring) ||
            (grid.get(x, y) !== Tile.Floor && !isFree(state, x, y))
              ? 1
              : 0;
        }
      }
      connectCaves(view, random, {
        tunnel: { style, width, windiness, borderWalls, blocked },
        loops,
        symmetry,
        symmetryChance,
      });
      for (let y = 0; y < grid.height; ++y) {
        for (let x = 0; x < grid.width; ++x) {
          if (view.get(x, y) === Tile.Floor && grid.get(x, y) !== Tile.Floor) {
            stampTile(state, x, y, Tile.Floor);
          }
        }
      }
      return {};
    },
  );
}
