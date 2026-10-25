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
import { roadClearing } from '../roads/road-clearing';
import type { ForestOptions } from './forest-options';
import type { ForestResult } from './forest-result';

/**
 * Generates a forest. A noise map says how dense the trees are on each tile,
 * from `minDensity` where the noise is lowest to `maxDensity` where it is
 * highest, and every tile then gets a tree with that chance. With the `roads`
 * option, roads are laid first and keep the trees off themselves and, with a
 * `clearance`, off the tiles beside them.
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
  } = options;

  assertDimensions(width, height);
  assertFraction('minDensity', minDensity);
  assertFraction('maxDensity', maxDensity);
  assertTile('groundTile', groundTile);
  assertTile('treeTile', treeTile);
  assertTile('roadTile', roadTile);
  assertWholeNumber('clearance', clearance, 0);
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

  const cleared =
    roads && roadClearing(roads.covered, width, height, clearance);

  const grid = new Grid(width, height);
  const chances = new Float32Array(width * height);
  for (let y = 0; y < height; ++y) {
    for (let x = 0; x < width; ++x) {
      // the noise from -1 to 1 becomes a position between the two densities
      const level =
        (Math.max(-1, Math.min(1, noise(x + 0.5, y + 0.5))) + 1) / 2;
      const road = roads?.covered[y * width + x] === 1;
      // no trees near a road, but the road keeps its own density
      const thinning = !road && cleared?.[y * width + x] ? 0 : 1;
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
