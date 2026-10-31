import type { Area } from '../core/area';
import type { Range } from '../core/range';
import type { CisternSide } from './cistern-side';

/**
 * A canal of a sewer as `planSewer` plans it, with its tunnel and chambers.
 * Along is the way the canal runs, across the other way. The tunnel holds the
 * water with a walkway of one tile on each side.
 */
export interface SewerLine {
  horizontal: boolean;
  level: 'trunk' | 'branch';
  /** Index of the line it meets, absent for the trunk. */
  parent?: number;
  /** Which way along the line runs away from its parent: 1 or -1, and 1 for the trunk. */
  outward: 1 | -1;
  /** The first row (horizontal) or column of the water. */
  across: number;
  /** How many tiles wide the water is. */
  width: number;
  /** The floor of the tunnel along the line, without its chambers. */
  tunnel: Range;
  /** The water along the line, from the edge of the parent's water, the ledge of its junction cistern or the trunk's end, to its mouth, which is on the ledge of its head cistern when it has one. */
  water: Range;
  /** The chamber where a branch meets its parent. */
  junction?: Area;
  /** The sides of the junction chamber that have a ledge, when it is a cistern. */
  junctionLedges?: CisternSide[];
  /** The chamber at the end of a branch, which its water runs through to the far wall, or a cistern its water runs into. */
  head?: Area;
  /** The sides of the head chamber that have a ledge, when it is a cistern. */
  headLedges?: CisternSide[];
  /** The ends of the trunk at the border of the map, `1` for its far end and `-1` for its near one, each with the walkway whose border tile is the way out: `-1` before the water, `1` after it. */
  outfalls?: { end: 1 | -1; side: 1 | -1 }[];
}
