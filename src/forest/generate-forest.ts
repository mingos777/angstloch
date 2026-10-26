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
import { layRoads } from '../roads/lay-roads';
import { assertDistanceMetric } from '../roads/assert-distance-metric';
import { roadDistance } from '../roads/road-distance';
import type { ForestOptions } from './forest-options';
import type { ForestResult } from './forest-result';

/**
 * Generates a forest. A noise map says how dense the trees are on each tile,
 * from `minDensity` where the noise is lowest to `maxDensity` where it is
 * highest, and every tile then gets a tree with that chance. With the `roads`
 * option, roads are laid first and keep the trees off themselves and, with a
 * `clearance`, off the tiles beside them, and with a `falloff` the trees
 * thin out gradually beyond that.
 */
export function generateForest(options: ForestOptions): ForestResult {
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
    clearance = 0,
    falloff = 0,
    distance = 'chebyshev',
  } = options;

  assertDimensions(width, height);
  assertFraction('minDensity', minDensity);
  assertFraction('maxDensity', maxDensity);
  assertTile('groundTile', groundTile);
  assertTile('treeTile', treeTile);
  assertTile('roadTile', roadTile);
  assertWholeNumber('clearance', clearance, 0);
  assertWholeNumber('falloff', falloff, 0);
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

  const roads = options.roads
    ? layRoads(width, height, random, options.roads)
    : undefined;

  const distances =
    roads &&
    roadDistance(
      roads.covered,
      width,
      height,
      distance,
      clearance + falloff + 1,
    );

  const grid = new Grid(width, height);
  const chances = new Float32Array(width * height);
  for (let y = 0; y < height; ++y) {
    for (let x = 0; x < width; ++x) {
      // the noise from -1 to 1 becomes a position between the two densities
      const level =
        (Math.max(-1, Math.min(1, noise(x + 0.5, y + 0.5))) + 1) / 2;
      const road = roads?.covered[y * width + x] === 1;
      // no trees near a road, then a ramp back up to the full density; the
      // road keeps its own density
      const away = (distances?.[y * width + x] ?? Infinity) - clearance;
      const thinning = road
        ? 1
        : Math.max(0, Math.min(1, away / (falloff + 1)));
      const chance =
        (minDensity + (maxDensity - minDensity) * level) * thinning;
      chances[y * width + x] = chance;
      const tree = random() < chance;
      grid.set(x, y, road ? roadTile : tree ? treeTile : groundTile);
    }
  }
  return {
    grid,
    density: chances,
    roads: roads?.roads ?? [],
    junctions: roads?.junctions ?? [],
    exits: roads?.exits ?? [],
  };
}
