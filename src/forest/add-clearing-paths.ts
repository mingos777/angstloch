import { assertTile } from '../core/assert-tile';
import { Tile } from '../core/tile';
import type { MapStep } from '../pipeline/map-step';
import { stampTile } from '../pipeline/stamp-tile';
import { step } from '../pipeline/step';
import { assertVerge } from '../roads/assert-verge';
import { collectLaidRoads } from '../roads/collect-laid-roads';
import { pruneVerge } from '../roads/prune-verge';
import { rebuildRoadMap } from '../roads/rebuild-road-map';
import type { Road } from '../roads/road';
import { TemplatePlacementError } from '../rooms/templates/template-placement-error';
import type { AddedRoads } from '../streams/add-roads';
import { findBridges } from '../streams/find-bridges';
import { findSpans } from '../streams/find-spans';
import { rebuildStreamMap } from '../streams/rebuild-stream-map';
import type { AddClearingPathsOptions } from './add-clearing-paths-options';
import type { ClearingPath } from './clearing-path';
import type { ForestTemplate } from './forest-template';
import { layClearingPaths } from './lay-clearing-paths';
import type { PlacedClearing } from './placed-clearing';

/**
 * A step that lays the paths that clearings asked for, each from the nearest
 * road (or from the nearest border when there are no roads) to the center of
 * its clearing. A path stops short of the template on its clearing, at the
 * first tile of its box that something has been stamped on. A path to a clearing
 * that a road runs through the center of needs none and gets none. It paints
 * `roadTile` over free ground and clears the trees of its verge, and where a
 * path crosses water it makes a bridge only if it spans it, and gives way to
 * the water otherwise. It adds `roads`, `junctions`, `exits` and `bridges`
 * again, with the paths added to the roads that were there.
 *
 * It needs `clearings`, and uses `roads` (where a path starts), `templates`
 * (where it stops) and `streams` (where it bridges). A path that still runs
 * through a template, which can happen to a path to another clearing, throws a
 * `TemplatePlacementError`, which `pipeline` answers with a new map. So run it
 * after `placeClearings` and `placeTemplates`, and before `addFootbridges`.
 * Throws a `RangeError` at once for a bad option.
 */
export function addClearingPaths(
  options: AddClearingPathsOptions = {},
): MapStep<
  { clearings: PlacedClearing[] } & Partial<{
    roads: Road[];
    streams: Road[];
    templates: ForestTemplate[];
  }>,
  AddedRoads
> {
  const { roadTile = Tile.Road, bridgeTile = Tile.Bridge } = options;
  assertTile('roadTile', roadTile);
  assertTile('bridgeTile', bridgeTile);
  assertVerge('addClearingPaths', options);

  return step<
    { clearings: PlacedClearing[] } & Partial<{
      roads: Road[];
      streams: Road[];
      templates: ForestTemplate[];
    }>,
    AddedRoads
  >(
    'addClearingPaths',
    { needs: ['clearings'], adds: ['roads', 'junctions', 'exits', 'bridges'] },
    (state, { random }) => {
      const { grid, base, prunable } = state;
      const { width, height } = grid;
      const templates = state.templates ?? [];
      const map = rebuildRoadMap(state.roads ?? [], width, height, random);
      const water =
        state.streams && rebuildStreamMap(state.streams, width, height).water;

      // untouched ground and ground cover can be built on
      const free = (x: number, y: number) =>
        grid.get(x, y) === base || prunable[y * width + x] === 1;
      const inBox = (x: number, y: number, box: ForestTemplate) =>
        x >= box.x &&
        y >= box.y &&
        x < box.x + box.width &&
        y < box.y + box.height;

      const paths: ClearingPath[] = state.clearings.flatMap(
        ({ x, y, path }, clearing) => {
          if (!path) {
            return [];
          }
          const own = templates.find((placed) => placed.clearing === clearing);
          return [
            {
              to: { x, y },
              width: path.width,
              windiness: path.windiness,
              clearing,
              stopAt: own
                ? (tx: number, ty: number) =>
                    inBox(tx, ty, own) && !free(tx, ty)
                : undefined,
            },
          ];
        },
      );
      const before = Uint8Array.from(map.covered);
      layClearingPaths(map, paths);
      const laid = collectLaidRoads(map);

      // the tiles the paths took
      const added = Uint8Array.from(laid.covered, (tile, at) =>
        tile === 1 && before[at] !== 1 ? 1 : 0,
      );
      const spans = water && findSpans(water, laid.covered, width, height);
      let any = false;
      for (let at = 0; at < added.length; ++at) {
        if (added[at] !== 1) {
          continue;
        }
        any = true;
        const x = at % width;
        const y = Math.floor(at / width);
        const over = water?.[at] === 1;
        // a path that a template stopped short of never reaches it, so a
        // path that is inside a template ran through it
        const through = templates.find((placed) => inBox(x, y, placed));
        if (through && !over && !free(x, y)) {
          throw new TemplatePlacementError(
            through.template,
            undefined,
            'a road or path runs through it',
          );
        }
        // a path over water is a bridge where it spans the water, and gives
        // way to the water everywhere else
        if (!over || spans?.[at] === 1) {
          stampTile(state, x, y, over ? bridgeTile : roadTile);
        }
      }
      if (any && (options.clearance ?? 0) + (options.falloff ?? 0) > 0) {
        pruneVerge(state, added, options, random);
      }

      const surface = Uint8Array.from(laid.covered, (tile, at) =>
        tile === 1 &&
        (water?.[at] !== 1 ||
          grid.get(at % width, Math.floor(at / width)) === bridgeTile)
          ? 1
          : 0,
      );
      return {
        roads: laid.roads,
        junctions: laid.junctions,
        exits: laid.exits,
        bridges: water ? findBridges(water, surface, width, height) : [],
      };
    },
  );
}
