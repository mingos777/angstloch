import { carveDirectTunnel } from './carve-direct-tunnel';
import { carveWindingTunnel } from './carve-winding-tunnel';
import { findCaveLink } from './find-cave-link';
import { findCaveRegions } from './find-cave-regions';
import type { Grid } from '../core/grid';
import { planCaveLoops } from './plan-cave-loops';
import type { Random } from '../core/random';
import type { TunnelOptions } from './tunnel-options';

/**
 * Joins all caverns into one by digging tunnels, in place. The largest
 * cavern is joined to its nearest neighbor first, and the group keeps growing
 * that way, so every tunnel is as short as it can be. Then every tunnel that
 * would be a shortcut between neighboring caverns is dug with the chance
 * `loops`, which makes loops.
 */
export function connectCaves(
  grid: Grid,
  random: Random,
  options: TunnelOptions,
  loops: number,
): void {
  const carve =
    options.style === 'direct' ? carveDirectTunnel : carveWindingTunnel;
  const caverns = findCaveRegions(grid);
  for (;;) {
    const [largest, ...others] = findCaveRegions(grid);
    const link = largest && others.length > 0 && findCaveLink(grid, largest);
    if (!link) {
      break;
    }
    carve(grid, random, link.from, link.to, options);
  }
  if (loops > 0) {
    for (const link of planCaveLoops(grid, caverns)) {
      if (random() < loops) {
        carve(grid, random, link.from, link.to, options);
      }
    }
  }
}
