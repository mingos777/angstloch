import type { LayoutSymmetry } from '../core/layout-symmetry';
import type { Range } from '../core/range';
import type { MineHallEntrances } from './mine-hall-entrances';

/** Options of `digVeins`. */
export interface DigVeinsOptions {
  /** The share of the rock that was free when the step began that the veins dig out, from 0 to 1. The veins that join the pieces of floor are dug whatever it says, and are counted. With 0 nothing else is dug. Above that, the web grows junctions of its own, in free rock, each joined to the nearest part of the network, until the share is reached or there is no room, and then extra veins make loops. Defaults to 0.15. */
  density?: number;
  /** Width of a vein in whole tiles, as a `Range`. One is picked for every vein. Defaults to `{ min: 1, max: 2 }`. */
  veinWidth?: Range;
  /** How much the veins wind, from 0 (straight) to 1. Defaults to 0.5. */
  veinWindiness?: number;
  /** About how far apart the junctions of the web lie, in tiles, a whole number of at least 3. A larger value makes a coarser web with longer veins. Defaults to 16. */
  veinSpacing?: number;
  /** Where a vein starts on a piece of floor: `facing` along the side that faces the nearest part of the network, `edge` on any side. Defaults to `facing`. */
  hallEntrances?: MineHallEntrances;
  /** The symmetry of the map, which veins follow by getting twins mirrored or rotated about the center of the map: `horizontal`, `vertical`, `both` or `rotational`. Defaults to `none`. */
  symmetry?: LayoutSymmetry;
  /** How often a vein gets its twins, from 0 (never) to 1 (always, which keeps a perfectly symmetric map perfectly symmetric). Applies with a `symmetry` only. Defaults to 1. */
  symmetryChance?: number;
}
