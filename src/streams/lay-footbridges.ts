import type { Point } from '../core/point';
import { assertTile } from '../core/assert-tile';
import { assertWholeNumber } from '../core/assert-whole-number';
import { Tile } from '../core/tile';
import type { MapStep } from '../pipeline/map-step';
import { stampTile } from '../pipeline/stamp-tile';
import { step } from '../pipeline/step';
import type { Road } from '../roads/road';
import type { LayFootbridgesOptions } from './lay-footbridges-options';
import { findBridges } from './find-bridges';
import { buildFootbridges } from './build-footbridges';
import { rebuildStreamMap } from './rebuild-stream-map';

/**
 * A step that lays footbridges across the streams, one tile wide: first where
 * the water cuts the land into large pieces that nothing joins, so that the
 * walkable land is one piece, then as many more as `minimum` asks for. Only a
 * stream at least 2 tiles wide cuts the land, and a footbridge never lies on
 * the edge of the map. A water tile that holds `bridgeTile` already, the
 * bridge of a road, counts as land. It stamps `bridgeTile` and adds `bridges`
 * again, with the footbridges and the bridges of roads, which replaces the
 * list of `layRoads`.
 *
 * It needs `streams`, so it must come after `layStreams`, and after every step
 * that lays roads, since a road that bridges a stream makes a footbridge
 * unnecessary. Throws a `RangeError` at once for a bad option.
 */
export function layFootbridges(
  options: LayFootbridgesOptions = {},
): MapStep<{ streams: Road[] }, { bridges: Point[] }> {
  const { minimum = 0, bridgeTile = Tile.Bridge } = options;
  assertWholeNumber('minimum', minimum, 0);
  assertTile('bridgeTile', bridgeTile);

  return step<{ streams: Road[] }, { bridges: Point[] }>(
    'layFootbridges',
    { needs: ['streams'], adds: ['bridges'] },
    (state, { random }) => {
      const { grid } = state;
      const { width, height } = grid;
      const layout = rebuildStreamMap(state.streams, width, height);
      const { water } = layout;
      // the bridges that roads made count as land
      const crossed = Uint8Array.from(water, (wet, at) =>
        wet === 1 && grid.get(at % width, Math.floor(at / width)) === bridgeTile
          ? 1
          : 0,
      );
      const foot = buildFootbridges(layout, crossed, random, minimum);
      const surface = Uint8Array.from(
        foot,
        (tile, at) => tile | (crossed[at] ?? 0),
      );
      foot.forEach((tile, at) => {
        if (tile === 1) {
          stampTile(state, at % width, Math.floor(at / width), bridgeTile);
        }
      });
      return { bridges: findBridges(water, surface, width, height) };
    },
  );
}
