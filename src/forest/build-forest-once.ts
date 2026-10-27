import { assertDimensions } from '../core/assert-dimensions';
import { assertFraction } from '../core/assert-fraction';
import { assertTile } from '../core/assert-tile';
import { assertWholeNumber } from '../core/assert-whole-number';
import { Grid } from '../core/grid';
import { resolveRandom } from '../core/resolve-random';
import { Tile } from '../core/tile';
import { createFractalNoise } from '../noise/create-fractal-noise';
import { createSimplexNoise } from '../noise/create-simplex-noise';
import { transformNoise } from '../noise/transform-noise';
import { assertRoadOptions } from '../roads/assert-road-options';
import { collectLaidRoads } from '../roads/collect-laid-roads';
import { createRoadMap } from '../roads/create-road-map';
import { layRoadNetwork } from '../roads/lay-road-network';
import { assertDistanceMetric } from '../roads/assert-distance-metric';
import { roadDistance } from '../roads/road-distance';
import { stampRoadBrush } from '../roads/stamp-road-brush';
import { traceTiles } from '../roads/trace-tiles';
import { assertStreamOptions } from '../streams/assert-stream-options';
import { createSteerAcrossStreams } from '../streams/create-steer-across-streams';
import type { CrossingPlan } from '../streams/crossing-plan';
import { findBridges } from '../streams/find-bridges';
import { findSpans } from '../streams/find-spans';
import { layFootbridges } from '../streams/lay-footbridges';
import { layStreams } from '../streams/lay-streams';
import { assertForestTemplates } from './assert-forest-templates';
import { isTemplateCell } from './is-template-cell';
import { placeForestTemplates } from './place-forest-templates';
import { TemplatePlacementError } from '../rooms/templates/template-placement-error';
import { templateTile } from './template-tile';
import { layClearingPaths } from './lay-clearing-paths';
import { layClearings } from './lay-clearings';
import type { ForestObserver } from './forest-observer';
import type { ForestOptions } from './forest-options';
import type { ForestResult } from './forest-result';

/**
 * Builds one forest, which fails with a `TemplatePlacementError` when a
 * template finds no place in it. `observer`, if given, is told the roads as
 * they were grown and the plans of their crossings.
 */
export function buildForestOnce(
  options: ForestOptions,
  observer?: ForestObserver,
): ForestResult {
  const {
    width,
    height,
    scaleX = 40,
    scaleY = 40,
    rotation = 0,
    octaves = 1,
    persistence = 0.2,
    lacunarity = 1,
    minDensity = 0,
    maxDensity = 0.25,
    groundTile = Tile.Grass,
    treeTile = Tile.Tree,
    roadTile = Tile.Road,
    shallowTile = Tile.ShallowWater,
    deepTile = Tile.DeepWater,
    bridgeTile = Tile.Bridge,
    clearance = 0,
    falloff = 0,
    bankClearance = 0,
    bankFalloff = 0,
    clearingSpacing = 0,
    distance = 'chebyshev',
  } = options;

  assertDimensions(width, height);
  assertFraction('minDensity', minDensity);
  assertFraction('maxDensity', maxDensity);
  assertTile('groundTile', groundTile);
  assertTile('treeTile', treeTile);
  assertTile('roadTile', roadTile);
  assertTile('shallowTile', shallowTile);
  assertTile('deepTile', deepTile);
  assertTile('bridgeTile', bridgeTile);
  assertWholeNumber('clearance', clearance, 0);
  assertWholeNumber('falloff', falloff, 0);
  assertWholeNumber('bankClearance', bankClearance, 0);
  assertWholeNumber('bankFalloff', bankFalloff, 0);
  assertWholeNumber('clearingSpacing', clearingSpacing, 0);
  assertDistanceMetric(distance);
  const random = resolveRandom(options.random);

  const noise = transformNoise(
    options.noise ??
      createFractalNoise(createSimplexNoise(random), {
        octaves,
        persistence,
        lacunarity,
      }),
    { scaleX, scaleY, rotation },
  );

  if (options.streams) {
    assertStreamOptions(options.streams);
  }
  const specs = options.clearings ?? [];
  const templates = options.templates ?? [];
  assertForestTemplates(templates);
  if (options.roads) {
    assertRoadOptions(options.roads);
  }
  // the streams come first, and the roads that are generated bend to cross them
  const streams = options.streams
    ? layStreams(width, height, random, options.streams)
    : undefined;
  // paths to clearings need a road map too, even when there are no roads
  // how the generated roads cross the streams
  const plans: CrossingPlan[] = [];
  const map =
    options.roads || specs.some((spec) => spec.path)
      ? createRoadMap(width, height, random, options.roads?.windiness)
      : undefined;
  if (map && options.roads) {
    const steer =
      streams &&
      createSteerAcrossStreams(
        streams,
        random,
        options.streams?.bridgeAngle ?? { min: 75, max: 90 },
        { noise: map.noise, windiness: map.windiness },
        (plan) => {
          plans.push(plan);
          observer?.planned?.(plan);
        },
      );
    const { grown } = observer ?? {};
    layRoadNetwork(
      map,
      random,
      options.roads,
      grown
        ? (points, width) => {
            grown(points);
            return steer ? steer(points, width) : points;
          }
        : steer,
    );
  }

  // the dead ends of the branches that end inside the map, for the clearings
  // at a branch end
  const branchEnds = (map?.roads ?? []).flatMap(({ kind, points }) => {
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

  // random clearings keep their distance from the roads that are there so far
  const laid = layClearings(specs, width, height, random, {
    spacing: clearingSpacing,
    branchEnds,
    streamTiles: streams?.map.roads.flatMap(({ points }) => points),
    roads:
      map && map.roads.length > 0
        ? { covered: map.covered, metric: distance }
        : undefined,
  });

  // templates go on the clearings and stay clear of roads and water, so a path
  // to a clearing is laid after them and stops at the edge of its template
  const footprints = placeForestTemplates(
    random,
    templates,
    laid.clearings,
    width,
    height,
    Uint8Array.from(
      { length: width * height },
      (_, at) => map?.covered[at] || streams?.water[at] || 0,
    ),
  );
  if (map) {
    layClearingPaths(
      map,
      laid.paths.map((path) => {
        const footprint = footprints.find(
          ({ placed }) => placed.clearing === path.clearing,
        );
        return footprint
          ? {
              ...path,
              stopAt: (x: number, y: number) => isTemplateCell(footprint, x, y),
            }
          : path;
      }),
    );
  }
  const roads = map && collectLaidRoads(map);
  // a path to another clearing may still have run through a template
  for (const footprint of footprints) {
    const { x, y, template } = footprint.placed;
    footprint.cells.forEach((row, dy) => {
      row.forEach((_, dx) => {
        if (
          isTemplateCell(footprint, x + dx, y + dy) &&
          roads?.covered[(y + dy) * width + x + dx] === 1
        ) {
          throw new TemplatePlacementError(
            template,
            templates[template]?.name,
            'a road or path runs through it',
          );
        }
      });
    });
  }

  const distances =
    roads &&
    roadDistance(
      roads.covered,
      width,
      height,
      distance,
      clearance + falloff + 1,
    );
  const clearingDistances =
    laid.clearings.length > 0
      ? roadDistance(laid.covered, width, height, distance, falloff + 1)
      : undefined;

  // the trees thin out beside water as well, with a verge of its own
  const bankDistances =
    streams && bankClearance + bankFalloff > 0
      ? roadDistance(
          streams.water,
          width,
          height,
          distance,
          bankClearance + bankFalloff + 1,
        )
      : undefined;

  // a template with a clearing of its own has the box free of trees, and the
  // trees thicken over its margin
  const ownClearings = footprints.filter(({ placed }) => placed.ownClearing);
  const templateDistances = ownClearings.map(({ placed, margin }) => {
    const box = new Uint8Array(width * height);
    for (let y = placed.y; y < placed.y + placed.height; ++y) {
      box.fill(1, y * width + placed.x, y * width + placed.x + placed.width);
    }
    return {
      margin,
      distances: roadDistance(box, width, height, distance, margin + 1),
    };
  });

  // how far up the ramp from no trees to full density a tile is, `away` tiles beyond the edge
  const ramp = (away: number, steps: number) => away / (steps + 1);

  // a generated road is a bridge along the straight runs of its crossings;
  // any other road over water that does not span it, because it clips a
  // bank, runs along a stream or ends in it, gives way to the water
  const crossed = new Uint8Array(width * height);
  for (const { width: roadWidth, crossings } of plans) {
    for (const { approach, departure } of crossings) {
      for (const { x, y } of traceTiles(approach, departure)) {
        stampRoadBrush(crossed, width, height, x, y, roadWidth);
      }
    }
  }
  const spans =
    streams && roads && findSpans(streams.water, roads.covered, width, height);
  const dry = (at: number) =>
    streams?.water[at] !== 1 || spans?.[at] === 1 || crossed[at] === 1;

  // footbridges where the water cuts the land in two, and as many more as asked for
  const footbridges =
    streams &&
    layFootbridges(
      streams,
      roads &&
        Uint8Array.from(roads.covered, (tile, at) => (dry(at) ? tile : 0)),
      random,
      options.streams?.bridges ?? 0,
    );

  // the tiles where something crosses the water: roads and footbridges
  const crossings =
    streams &&
    footbridges &&
    Uint8Array.from(
      footbridges,
      (tile, at) => tile | (dry(at) ? (roads?.covered[at] ?? 0) : 0),
    );

  const grid = new Grid(width, height);
  const chances = new Float32Array(width * height);
  for (let y = 0; y < height; ++y) {
    for (let x = 0; x < width; ++x) {
      // the noise from -1 to 1 becomes a position between the two densities
      const level =
        (Math.max(-1, Math.min(1, noise(x + 0.5, y + 0.5))) + 1) / 2;
      const road = roads?.covered[y * width + x] === 1 && dry(y * width + x);
      // no trees near a road, in a clearing or beside water, then a ramp
      // back up to the full density; the road keeps its own density
      const roadRamp = ramp(
        (distances?.[y * width + x] ?? Infinity) - clearance,
        falloff,
      );
      const clearingRamp = ramp(
        clearingDistances?.[y * width + x] ?? Infinity,
        falloff,
      );
      const bankRamp = ramp(
        (bankDistances?.[y * width + x] ?? Infinity) - bankClearance,
        bankFalloff,
      );
      const templateRamp = Math.min(
        1,
        ...templateDistances.map(({ margin, distances: away }) =>
          ramp(away[y * width + x] ?? Infinity, margin),
        ),
      );
      const thinning = road
        ? 1
        : Math.max(
            0,
            Math.min(1, roadRamp, clearingRamp, bankRamp, templateRamp),
          );
      const chance =
        (minDensity + (maxDensity - minDensity) * level) * thinning;
      chances[y * width + x] = chance;
      const tree = random() < chance;
      const water = streams?.water[y * width + x] === 1;
      grid.set(
        x,
        y,
        water
          ? road || footbridges?.[y * width + x] === 1
            ? bridgeTile
            : streams.deep[y * width + x]
              ? deepTile
              : shallowTile
          : road
            ? roadTile
            : tree
              ? treeTile
              : groundTile,
      );
    }
  }
  for (const footprint of footprints) {
    const { x, y } = footprint.placed;
    footprint.cells.forEach((row, dy) => {
      row.forEach((cell, dx) => {
        const tile = templateTile(cell);
        if (tile !== undefined) {
          grid.set(x + dx, y + dy, tile);
        }
      });
    });
  }
  return {
    grid,
    density: chances,
    roads: roads?.roads ?? [],
    junctions: roads?.junctions ?? [],
    exits: roads?.exits ?? [],
    streams: streams?.streams ?? [],
    bridges: crossings
      ? findBridges(streams.water, crossings, width, height)
      : [],
    clearings: laid.clearings,
    templates: footprints.map(({ placed }) => placed),
  };
}
