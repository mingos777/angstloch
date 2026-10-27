import { buildForest } from './build-forest';
import type { ForestOptions } from './forest-options';
import type { ForestResult } from './forest-result';

/**
 * Generates a forest. A noise map says how dense the trees are on each tile,
 * from `minDensity` where the noise is lowest to `maxDensity` where it is
 * highest, and every tile then gets a tree with that chance. With the `roads`
 * option, roads are laid first and keep the trees off themselves and, with a
 * `clearance`, off the tiles beside them, and with a `falloff` the trees
 * thin out gradually beyond that. The `clearings` option makes glades with
 * ragged edges, which the `falloff` thins out as well.
 */
export function generateForest(options: ForestOptions): ForestResult {
  return buildForest(options);
}
