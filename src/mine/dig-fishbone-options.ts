import type { Range } from '../core/range';
import type { AreaSize } from '../pipeline/area-size';

/** Options of `digFishbone`. */
export interface DigFishboneOptions {
  /** The share of the area that is floor, from 0 to 1. It is a target, met as far as the area has room: the mine gets more tunnels until it is reached, and stops short when no more fit. The main shaft is always dug, so a low density does not remove it. Defaults to 0.15. */
  density?: number;
  /** Width of the main shaft in whole tiles, as a `Range`. One is picked at random. Defaults to `{ min: 2, max: 3 }`. */
  shaftWidth?: Range;
  /** How much the main shaft winds, from 0 (straight) to 1. Defaults to 0.1. */
  shaftWindiness?: number;
  /** Direction of the main shaft in degrees, clockwise from east, so 0 runs left to right and 90 top to bottom. `random` picks an angle for every copy. Defaults to `random`. */
  angle?: number | 'random';
  /** Width of the side tunnels, the adits, in whole tiles, as a `Range`. One is picked for every adit. Defaults to `{ min: 1, max: 2 }`. */
  aditWidth?: Range;
  /** How much the adits wind, from 0 (straight) to 1. Defaults to 0.4. */
  aditWindiness?: number;
  /** Length of an adit in whole tiles, as a `Range`, measured along the line it follows, so an adit at a diagonal covers up to about 40% more tiles. One is picked for every adit, and an adit that is stopped short by another tunnel or the edge of the area and ends shorter than the minimum is not dug. Defaults to `{ min: 15, max: 50 }`. */
  aditLength?: Range;
  /** The angle in whole degrees, from 1 to 179, between an adit and the tunnel it leaves, as a `Range`. It is picked at random, and the adit leaves along the tunnel or against it, to the left or the right. Defaults to `{ min: 45, max: 90 }`. */
  branchAngle?: Range;
  /** The chance, from 0 to 1, that an adit that runs into another tunnel breaks through and joins it, which makes a loop, instead of stopping short and ending in a dead end. Defaults to 0, which makes no loops. */
  loops?: number;
  /** The size of the part of the map to dig in. Defaults to the whole map. A smaller area goes on a random free spot, and the mine is closed in by a ring of wall inside it. */
  area?: AreaSize;
  /** How many mines to dig, each in an area of its own, a `Range` of whole numbers of at least 0. One is picked. Defaults to `{ min: 1, max: 1 }`. */
  count?: Range;
}
