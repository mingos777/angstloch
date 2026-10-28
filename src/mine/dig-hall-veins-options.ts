import type { Range } from '../core/range';
import type { MineHallEntrances } from './mine-hall-entrances';

/** Options of `digHallVeins`. */
export interface DigHallVeinsOptions {
  /** How many veins to dig between the halls in all, as a `Range`. One is picked. The veins that join the halls into one network come first, at least one for every hall but the first, whatever this says, and the rest are extra veins that make loops. A vein is routed through the rock around the halls. Defaults to `{ min: 2, max: 4 }`. */
  hallVeins?: Range;
  /** Where a vein starts on its hall: `facing` along the side that faces the nearest part of the network, `edge` on any side. Defaults to `facing`. */
  hallEntrances?: MineHallEntrances;
  /** Width of a vein in whole tiles, as a `Range`. One is picked for every vein. Defaults to `{ min: 1, max: 2 }`. */
  veinWidth?: Range;
  /** How far the veins stray sideways from their route around the halls, from 0 (not at all) to 1. Defaults to 0.5. */
  veinWindiness?: number;
}
