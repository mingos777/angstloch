import type { Point } from '../core/point';
import { assertTile } from '../core/assert-tile';
import { Tile } from '../core/tile';
import type { MapStep } from '../pipeline/map-step';
import { stampTile } from '../pipeline/stamp-tile';
import { step } from '../pipeline/step';
import { assertDegrees } from '../roads/assert-degrees';
import { assertRoadOptions } from '../roads/assert-road-options';
import { assertVerge } from '../roads/assert-verge';
import { collectLaidRoads } from '../roads/collect-laid-roads';
import { createRoadMap } from '../roads/create-road-map';
import { layRoadNetwork } from '../roads/lay-road-network';
import { pruneVerge } from '../roads/prune-verge';
import type { Road } from '../roads/road';
import { stampRoadBrush } from '../roads/stamp-road-brush';
import { traceTiles } from '../roads/trace-tiles';
import type { AddRoadsOptions } from './add-roads-options';
import { createSteerAcrossStreams } from './create-steer-across-streams';
import type { CrossingPlan } from './crossing-plan';
import { findBridges } from './find-bridges';
import { findSpans } from './find-spans';
import { rebuildStreamMap } from './rebuild-stream-map';

/** What `addRoads` adds to the state. */
export interface AddedRoads {
  /** Every road, crossing and branch, in the order they were laid. */
  roads: Road[];
  /** The tiles where roads meet. */
  junctions: Point[];
  /** The tiles where roads reach the border of the map. */
  exits: Point[];
  /** One point per bridge: the tile in the middle of each group of bridge tiles. */
  bridges: Point[];
}

/**
 * A step that lays roads: a main road from one border to the other, with the
 * crossings and branches that `RoadOptions` asks for, or the exact `specs`.
 * It paints over whatever is there, then clears the trees of its verge.
 * It adds `roads`, `junctions`, `exits` and `bridges`.
 *
 * It uses `streams` when the state has them: a generated road is planned
 * across them and laid again through the plan, crossing at `bridgeAngle`, and
 * a road tile over water becomes a bridge where the crossing plan says so, or
 * where the road spans the water; any other road over water gives way to it.
 * So `addStreams` must come first. Reports every road as it was grown, and
 * every crossing plan, through `trace('addRoads', { grown, plans })`. Throws a
 * `RangeError` at once for a bad option.
 */
export function addRoads(
  options: AddRoadsOptions = {},
): MapStep<Partial<{ streams: Road[] }>, AddedRoads> {
  const {
    roadTile = Tile.Road,
    bridgeTile = Tile.Bridge,
    bridgeAngle = { min: 75, max: 90 },
  } = options;
  assertRoadOptions(options);
  assertDegrees('bridgeAngle', bridgeAngle);
  assertTile('roadTile', roadTile);
  assertTile('bridgeTile', bridgeTile);
  assertVerge('addRoads', options);

  return step<Partial<{ streams: Road[] }>, AddedRoads>(
    'addRoads',
    { adds: ['roads', 'junctions', 'exits', 'bridges'] },
    (state, { random, trace }) => {
      const { grid } = state;
      const { width, height } = grid;
      const streams =
        state.streams && rebuildStreamMap(state.streams, width, height);

      // the streams were laid first, and the roads that are generated bend to cross them
      const plans: CrossingPlan[] = [];
      const grown: Point[][] = [];
      const map = createRoadMap(width, height, random, options.windiness);
      const steer =
        streams &&
        createSteerAcrossStreams(
          streams,
          random,
          bridgeAngle,
          { noise: map.noise, windiness: map.windiness },
          (plan) => plans.push(plan),
        );
      layRoadNetwork(
        map,
        random,
        options,
        trace || steer
          ? (points, roadWidth) => {
              grown.push(points);
              return steer ? steer(points, roadWidth) : points;
            }
          : undefined,
      );
      const laid = collectLaidRoads(map);

      // a generated road is a bridge along the straight runs of its crossings;
      // any other road over water that does not span it, because it clips a
      // bank, runs along a stream or ends in it, gives way to the water
      const water = streams?.water;
      const crossed = new Uint8Array(width * height);
      for (const { width: roadWidth, crossings } of plans) {
        for (const { approach, departure } of crossings) {
          for (const { x, y } of traceTiles(approach, departure)) {
            stampRoadBrush(crossed, width, height, x, y, roadWidth);
          }
        }
      }
      const spans = water && findSpans(water, laid.covered, width, height);
      const dry = (at: number) =>
        water?.[at] !== 1 || spans?.[at] === 1 || crossed[at] === 1;

      const surface = new Uint8Array(width * height);
      for (let at = 0; at < surface.length; ++at) {
        if (laid.covered[at] === 1 && dry(at)) {
          surface[at] = 1;
          stampTile(
            state,
            at % width,
            Math.floor(at / width),
            water?.[at] === 1 ? bridgeTile : roadTile,
          );
        }
      }
      if ((options.clearance ?? 0) + (options.falloff ?? 0) > 0) {
        pruneVerge(state, laid.covered, options, random);
      }
      trace?.('addRoads', { grown, plans });

      return {
        roads: laid.roads,
        junctions: laid.junctions,
        exits: laid.exits,
        bridges: water ? findBridges(water, surface, width, height) : [],
      };
    },
  );
}
