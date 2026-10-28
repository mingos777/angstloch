import { assertTile } from '../core/assert-tile';
import { Tile } from '../core/tile';
import { assertVerge } from '../roads/assert-verge';
import type { Road } from '../roads/road';
import { pruneVerge } from '../roads/prune-verge';
import type { MapStep } from '../pipeline/map-step';
import { makePermanent } from '../pipeline/make-permanent';
import { stampTile } from '../pipeline/stamp-tile';
import { step } from '../pipeline/step';
import type { AddStreamsOptions } from './add-streams-options';
import { assertStreamOptions } from './assert-stream-options';
import { layStreams } from './lay-streams';

/**
 * A step that lays a stream or a river: a main stream from one border to the
 * other (or from a spring), with shallow banks, deep water in the middle
 * when it is wide enough, and tributaries. It paints over whatever is there,
 * then clears the trees of its verge. It adds `streams`, as roads whose
 * `points` run with the water, a tributary from its source to where it joins.
 *
 * It must come before the steps that lay roads, so that they can cross it,
 * and it throws when `roads` is already in the state. Throws a `RangeError`
 * at once for a bad option.
 */
export function addStreams(
  options: AddStreamsOptions = {},
): MapStep<{ roads?: unknown }, { streams: Road[] }> {
  const { shallowTile = Tile.ShallowWater, deepTile = Tile.DeepWater } =
    options;
  assertStreamOptions(options);
  assertTile('shallowTile', shallowTile);
  assertTile('deepTile', deepTile);
  assertVerge('addStreams', options);

  return step<{ roads?: unknown }, { streams: Road[] }>(
    'addStreams',
    { adds: ['streams'] },
    (state, { random }) => {
      if (state.roads !== undefined) {
        // the order is wrong however often the map is built again
        throw makePermanent(
          new TypeError(
            'Step "addStreams" must come before the steps that lay roads',
          ),
        );
      }
      const { grid } = state;
      const laid = layStreams(grid.width, grid.height, random, options);
      for (let y = 0; y < grid.height; ++y) {
        for (let x = 0; x < grid.width; ++x) {
          const at = y * grid.width + x;
          if (laid.water[at]) {
            stampTile(state, x, y, laid.deep[at] ? deepTile : shallowTile);
          }
        }
      }
      if ((options.clearance ?? 0) + (options.falloff ?? 0) > 0) {
        pruneVerge(state, laid.water, options, random);
      }
      return { streams: laid.streams };
    },
  );
}
