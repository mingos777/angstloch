import { carveDirectTunnel } from './carve-direct-tunnel';
import { carveWindingTunnel } from './carve-winding-tunnel';
import { createTransforms } from '../rooms/templates/create-transforms';
import { findCaveLink } from './find-cave-link';
import { findCaveRegions } from './find-cave-regions';
import type { Grid } from '../core/grid';
import { isCaveShortcut } from './is-cave-shortcut';
import type { LayoutSymmetry } from '../core/layout-symmetry';
import { measureCaveWalk } from './measure-cave-walk';
import { planCaveLoops } from './plan-cave-loops';
import type { Random } from '../core/random';
import { stampCaveTwins } from './stamp-cave-twins';
import type { TunnelOptions } from './tunnel-options';
import type { CaveLink } from './cave-link';

/** What `connectCaves` needs to know besides the shape of the tunnels. */
export interface ConnectCavesOptions {
  tunnel: TunnelOptions;
  /** The chance of a tunnel at each shortcut between neighboring caverns. */
  loops: number;
  /** The symmetry that the map has, and that tunnels follow. */
  symmetry: LayoutSymmetry;
  /** The chance that a tunnel gets twins. */
  symmetryChance: number;
}

/**
 * Joins all caverns into one by digging tunnels, in place. The largest
 * cavern is joined to its nearest neighbor first, and the group keeps growing
 * that way, so every tunnel is as short as it can be. Then every tunnel that
 * would be a shortcut between neighboring caverns is dug with the chance
 * `loops`, which makes loops. A loop is dug only if it is still a shortcut
 * when its turn comes, which a twin of it that was dug already prevents.
 * With a symmetry, every tunnel gets twins with the chance `symmetryChance`.
 *
 * No tunnel digs through a tile that `tunnel.blocked` marks. A group that
 * cannot reach another cavern that way is left as it is, and the next largest
 * one carries on.
 */
export function connectCaves(
  grid: Grid,
  random: Random,
  { tunnel, loops, symmetry, symmetryChance }: ConnectCavesOptions,
): void {
  const { blocked } = tunnel;
  const carve =
    tunnel.style === 'direct' ? carveDirectTunnel : carveWindingTunnel;
  const images = createTransforms(symmetry, grid.width, grid.height, false);
  const dig = ({ from, to }: CaveLink): void => {
    const before = images.length > 0 ? grid.clone() : undefined;
    carve(grid, random, from, to, tunnel);
    if (before && random() < symmetryChance) {
      stampCaveTwins(grid, before, images, blocked);
    }
  };
  const caverns = findCaveRegions(grid);
  // the tiles of groups that reach no other cavern
  const stranded = new Uint8Array(grid.width * grid.height);
  const isStranded = ({ x, y }: { x: number; y: number }) =>
    stranded[y * grid.width + x] === 1;
  for (;;) {
    const [largest, ...others] = findCaveRegions(grid).filter(
      (tiles) => !tiles.every(isStranded),
    );
    if (!largest || others.length === 0) {
      break;
    }
    const link = findCaveLink(grid, largest, blocked);
    if (link) {
      dig(link);
    }
    if (!link || measureCaveWalk(grid, link.from, link.to) === Infinity) {
      for (const { x, y } of largest) {
        stranded[y * grid.width + x] = 1;
      }
    }
  }
  if (loops > 0) {
    for (const link of planCaveLoops(grid, caverns, blocked)) {
      if (isCaveShortcut(grid, link) && random() < loops) {
        dig(link);
      }
    }
  }
}
