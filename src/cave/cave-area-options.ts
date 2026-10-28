import type { LayoutSymmetry } from '../core/layout-symmetry';
import type { Range } from '../core/range';
import type { AreaSize } from '../pipeline/area-size';
import type { CavePlacement } from './cave-placement';

/** The options that `growCave` and `carveNoiseCave` share: where the cave goes, its border, its symmetry and which of its caverns it keeps. */
export interface CaveAreaOptions {
  /** Keeps the outermost ring of tiles of the area solid wall. Defaults to true. */
  borderWalls?: boolean;
  /** Mirrors or rotates the cave about the center of its area: `horizontal` (left to right), `vertical` (top to bottom), `both` or `rotational` (by 180°). Defaults to `none`. */
  symmetry?: LayoutSymmetry;
  /** How often a tile copies its twin, from 0 (never, so the cave is not symmetric) to 1 (always, which makes it perfectly symmetric). Defaults to 1. */
  symmetryChance?: number;
  /** Leaves out every cavern of the area smaller than this many tiles, which removes small pockets. Defaults to 0, which keeps all. */
  minRegionSize?: number;
  /** Keeps only the largest cavern of the area. Defaults to false. */
  largestOnly?: boolean;
  /** The size of the part of the map to carve the cave in. Defaults to the whole map. A smaller area goes on a spot that `placement` picks. */
  area?: AreaSize;
  /** How many caves to carve, each in an area of its own, a `Range` of whole numbers of at least 0. One is picked. Defaults to `{ min: 1, max: 1 }`. */
  count?: Range;
  /** Where a smaller area goes. `free`: on a random spot where the box and a margin of one tile are all free. `beside`: the cave is built and culled first, then tried at 100 random spots, and goes where its floor and the 8 tiles round every floor tile are free, as near the dug ground as it finds; the box may overlap tunnels, the floor never touches them. `overlap`: on any spot, clear of the other copies, with floor laid on the free tiles only, so the cave runs into what is there. No placement digs a reserved tile. With `free` a copy that finds no spot fails the attempt; with `beside` the copies up to `count.min` do, and the ones above it are left out. Defaults to `free`. */
  placement?: CavePlacement;
}
