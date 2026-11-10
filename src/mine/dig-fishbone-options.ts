import type { Range } from '../core/range';
import type { AreaSpec } from '../pipeline/area-spec';

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
  /** How much the adits wind, from 0 (straight) to 1. Defaults to 0.1, so the ribs stay roughly parallel. */
  aditWindiness?: number;
  /** Length of an adit in whole tiles, as a `Range`, measured along the line it follows, so an adit at a diagonal covers up to about 40% more tiles. One is picked for every adit, and an adit that is stopped short by another tunnel or the edge of the area and ends shorter than the minimum is not dug. Defaults to `{ min: 15, max: 50 }`. */
  aditLength?: Range;
  /** The rib angle in whole degrees, from 1 to 179, between the adits and the forward direction of the main shaft, as a `Range`. One is picked for every mine, with a forward direction, one end of the shaft or the other: the adits on one side of the shaft run at the angle turned one way, those on the other side turned the other way, so the two sides mirror each other and both lean forward. Defaults to `{ min: 45, max: 90 }`. */
  branchAngle?: Range;
  /** The most, in whole degrees from 0 to 90, that an adit's starting heading may turn away from the line of its side, either way. One turn is picked for every adit, so the ribs are roughly parallel; 0 makes them start exactly parallel. Defaults to 10. */
  aditSpread?: number;
  /** The chance, from 0 to 1, that two neighboring adits on the same side of the shaft are joined by a crosscut: a straight tunnel of width 1, the shortest way across, from a random spot of the stretch where they run side by side. Each pair gets one crosscut at most, and none where the crosscut would come near another tunnel. Crosscuts make loops; with 0 every adit ends in a dead end. Defaults to 0.1. */
  crosscuts?: number;
  /** The size of the part of the map to dig in. Defaults to the whole map. A smaller area goes on a random free spot, and the mine is closed in by a ring of wall inside it. */
  area?: AreaSpec;
  /** How many mines to dig, each in an area of its own, a `Range` of whole numbers of at least 0. One is picked. Defaults to `{ min: 1, max: 1 }`. */
  count?: Range;
}
