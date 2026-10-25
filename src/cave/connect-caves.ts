import { carveDirectTunnel } from './carve-direct-tunnel';
import { carveWindingTunnel } from './carve-winding-tunnel';
import { findCaveLink } from './find-cave-link';
import { findCaveRegions } from './find-cave-regions';
import type { Grid } from '../core/grid';
import type { Random } from '../core/random';
import type { TunnelOptions } from './tunnel-options';

/**
 * Joins all caverns into one by digging tunnels, in place. The largest
 * cavern is joined to its nearest neighbor first, and the group keeps growing
 * that way, so every tunnel is as short as it can be.
 */
export function connectCaves(
  grid: Grid,
  random: Random,
  options: TunnelOptions,
): void {
  const carve =
    options.style === 'direct' ? carveDirectTunnel : carveWindingTunnel;
  for (;;) {
    const [largest, ...others] = findCaveRegions(grid);
    const link = largest && others.length > 0 && findCaveLink(grid, largest);
    if (!link) {
      return;
    }
    carve(grid, random, link.from, link.to, options);
  }
}
