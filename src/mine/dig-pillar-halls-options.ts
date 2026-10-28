import type { Range } from '../core/range';
import type { AreaSize } from '../pipeline/area-size';
import type { MineHallEntrances } from './mine-hall-entrances';

/** Options of `digPillarHalls`. */
export interface DigPillarHallsOptions {
  /** The share of the area that is floor, from 0 to 1. It sets the size of the halls that have no `hallSize`, so that they fill about this much, pillars taken off. Defaults to 0.35. */
  density?: number;
  /** How many halls to dig in each area, as a `Range`. One is picked. A hall that finds no room, at least 4 tiles of wall away from the others, is left out, so a crowded area gets fewer. Defaults to `{ min: 2, max: 4 }`. */
  halls?: Range;
  /** How many veins to dig between the halls of an area in all, as a `Range`. One is picked. The veins that join the halls into one network come first, at least one for every hall but the first, whatever this says, and the rest are extra veins that make loops. A vein is routed through the rock around the halls. Defaults to `{ min: 2, max: 4 }`. */
  hallVeins?: Range;
  /** Where a vein starts on its hall: `facing` along the side that faces the nearest part of the network, `edge` on any side. Defaults to `facing`. */
  hallEntrances?: MineHallEntrances;
  /** The width and the height of a hall in whole tiles, as a `Range`. Each side of each hall gets its own size, and a side is cut down to what the area has room for. Defaults to a size that makes the halls fill about the `density` of the area. */
  hallSize?: Range;
  /** How ragged the edges of the halls are, from 0 (clean rectangles) to 1. Defaults to 0.5. */
  hallRagged?: number;
  /** The width and the height of a pillar in whole tiles, as a `Range`. Each side of each pillar gets its own size. Defaults to `{ min: 2, max: 5 }`. */
  pillarSize?: Range;
  /** The gap between neighboring pillars in whole tiles, as a `Range`, picked once for each hall. Defaults to `{ min: 2, max: 4 }`. */
  pillarSpacing?: Range;
  /** How ragged the edges of the pillars are, from 0 (clean rectangles) to 1. Pillars of 2 tiles are too small to be ragged. Defaults to 0.5. */
  pillarRagged?: number;
  /** How far the pillars stray from a regular pattern, from 0 (a perfect grid) to 1 (as far as they can without touching). Defaults to 0.5. */
  pillarJitter?: number;
  /** Width of a vein in whole tiles, as a `Range`. One is picked for every vein. Defaults to `{ min: 1, max: 2 }`. */
  veinWidth?: Range;
  /** How far the veins stray sideways from their route around the halls, from 0 (not at all) to 1. Defaults to 0.5. */
  veinWindiness?: number;
  /** The size of the part of the map to dig in. Defaults to the whole map. A smaller area goes on a random free spot, and the halls are closed in by a ring of wall inside it. */
  area?: AreaSize;
  /** How many groups of halls to dig, each in an area of its own, a `Range` of whole numbers of at least 0. One is picked. Defaults to `{ min: 1, max: 1 }`. */
  count?: Range;
}
