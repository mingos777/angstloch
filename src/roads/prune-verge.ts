import type { Random } from '../core/random';
import type { MapState } from '../pipeline/map-state';
import { roadDistance } from './road-distance';
import type { Verge } from './verge';

/**
 * Removes ground cover from the verge of a feature. `mask` has a byte per
 * tile, 1 where the feature is. A prunable tile within the clearance of it
 * goes back to the base tile, and one in the falloff goes back with a chance
 * that falls from certain to none in equal steps. Only prunable tiles change,
 * and a tile that goes back stops being prunable. `random` is drawn once for
 * every prunable tile in the falloff.
 */
export function pruneVerge(
  state: Pick<MapState, 'grid' | 'base' | 'prunable'>,
  mask: Uint8Array,
  verge: Verge,
  random: Random,
): void {
  const { clearance = 0, falloff = 0, distance = 'chebyshev' } = verge;
  const { grid, base, prunable } = state;
  const { width, height } = grid;
  const distances = roadDistance(
    mask,
    width,
    height,
    distance,
    clearance + falloff + 1,
  );
  for (let at = 0; at < prunable.length; ++at) {
    if (!prunable[at]) {
      continue;
    }
    const away = (distances[at] ?? Infinity) - clearance;
    const keep = Math.min(1, away / (falloff + 1));
    if (keep >= 1) {
      continue;
    }
    // a tile in the clearance goes without a draw
    if (keep <= 0 || random() >= keep) {
      grid.set(at % width, Math.floor(at / width), base);
      prunable[at] = 0;
    }
  }
}
