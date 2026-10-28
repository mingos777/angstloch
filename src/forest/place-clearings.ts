import type { Point } from '../core/point';
import { assertWholeNumber } from '../core/assert-whole-number';
import type { MapStep } from '../pipeline/map-step';
import { step } from '../pipeline/step';
import { assertVerge } from '../roads/assert-verge';
import { pruneVerge } from '../roads/prune-verge';
import { rebuildRoadMap } from '../roads/rebuild-road-map';
import type { Road } from '../roads/road';
import { assertClearing } from './assert-clearing';
import { layClearings } from './lay-clearings';
import type { PlaceClearingsOptions } from './place-clearings-options';
import type { PlacedClearing } from './placed-clearing';

/**
 * A step that places clearings: glades with ragged edges, free of trees. It
 * stamps nothing, since a clearing is ground, and prunes every tree inside
 * the ragged shape and across the `falloff` beyond it. It adds `clearings`,
 * each with the path that was asked to lead to it, for `addClearingPaths`.
 *
 * It uses `roads` when the state has them: a clearing placed at random keeps
 * its `roadDistance` from them, and one `at: 'branch-end'` is centered on the
 * dead end of a branch that lies inside the map. It uses `streams` for a
 * clearing `at: 'stream'`. So run it after `addStreams` and `addRoads`, and
 * after `plantTrees`, so that there are trees to clear. A clearing that finds
 * no room is left out. Throws a `RangeError` at once for a bad option, and
 * when a clearing's center lies outside the map, which `pipeline` finds out
 * before the first attempt.
 */
export function placeClearings(
  options: PlaceClearingsOptions,
): MapStep<
  Partial<{ roads: Road[]; streams: Road[] }>,
  { clearings: PlacedClearing[] }
> {
  const { clearings: specs, spacing = 0 } = options;
  specs.forEach((spec, i) => {
    // the size of the map is not known yet, `validate` checks the centers
    assertClearing(`clearings[${String(i)}]`, spec, Infinity, Infinity);
  });
  assertWholeNumber('spacing', spacing, 0);
  assertVerge('placeClearings', options);

  return step<
    Partial<{ roads: Road[]; streams: Road[] }>,
    { clearings: PlacedClearing[] }
  >(
    'placeClearings',
    {
      adds: ['clearings'],
      // the centers must lie on the map
      validate: ({ grid }) => {
        specs.forEach((spec, i) => {
          assertClearing(
            `clearings[${String(i)}]`,
            spec,
            grid.width,
            grid.height,
          );
        });
      },
    },
    (state, { random }) => {
      const { grid } = state;
      const { width, height } = grid;
      const roads = state.roads ?? [];
      const map =
        roads.length > 0
          ? rebuildRoadMap(roads, width, height, random)
          : undefined;
      // the dead ends of the branches that end inside the map
      const branchEnds = roads.flatMap(({ kind, points }) => {
        const end = points[points.length - 1];
        return kind === 'branch' &&
          end &&
          end.x > 0 &&
          end.y > 0 &&
          end.x < width - 1 &&
          end.y < height - 1
          ? [end]
          : [];
      });
      const laid = layClearings(specs, width, height, random, {
        spacing,
        branchEnds,
        streamTiles: state.streams?.flatMap(({ points }): Point[] => points),
        roads: map
          ? { covered: map.covered, metric: options.distance ?? 'chebyshev' }
          : undefined,
      });
      if (laid.clearings.length > 0) {
        pruneVerge(
          state,
          laid.covered,
          { falloff: options.falloff, distance: options.distance },
          random,
        );
      }
      return {
        clearings: laid.clearings.map((clearing, at) => {
          const path = laid.paths.find(({ clearing: i }) => i === at);
          return path
            ? {
                ...clearing,
                path: { width: path.width, windiness: path.windiness },
              }
            : clearing;
        }),
      };
    },
  );
}
