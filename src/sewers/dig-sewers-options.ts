import type { Range } from '../core/range';
import type { AreaSize } from '../pipeline/area-size';

/** Options of `digSewers`. */
export interface DigSewersOptions {
  /** Which way the trunk runs: `'horizontal'`, `'vertical'`, or `'any'`, drawn for each sewer among the ways that fit its area. Defaults to `'any'`. */
  orientation?: 'horizontal' | 'vertical' | 'any';
  /** The width of the trunk's water in whole tiles of at least 1, drawn once per sewer and cut down to what the area has room for. Defaults to `{ min: 2, max: 3 }`. */
  trunkWidth?: Range;
  /** The width of a branch's water in whole tiles of at least 1, drawn for each branch. Defaults to `{ min: 1, max: 1 }`. */
  branchWidth?: Range;
  /** How many branches each sewer gets, a `Range` of whole numbers of at least 0. One is picked. A branch grows off the trunk or off an earlier branch, at right angles, and one that finds no room is left out, so a crowded area gets fewer. Defaults to `{ min: 3, max: 6 }`. */
  branches?: Range;
  /** The length of a branch's tunnel, from its junction chamber to its end or its head chamber, in whole tiles of at least 1. A branch is cut down to the room it has, and left out below `min`. Defaults to `{ min: 5, max: 12 }`. */
  branchLength?: Range;
  /** The width and the height of a chamber in whole tiles, as a `Range`, each side drawn on its own. A side is raised to hold the tunnels that meet there: a junction chamber spans its parent's tunnel and reaches at least a tile past it on the branch's side, and at least a tile past the branch's walkways along the parent; a head chamber reaches at least a tile past the branch's walkways on each side and is at least 3 tiles long. Defaults to `{ min: 5, max: 9 }`. */
  chamberSize?: Range;
  /** The chance that a branch ends in a head chamber, from 0 to 1, its canal running to the chamber's far wall. A head chamber that finds no room is left out. Defaults to 0.5. */
  headChance?: number;
  /** The chance that a tunnel gets a bridge across its canal besides the ones that keep the walkways joined, from 0 to 1. Defaults to 0.25. */
  bridgeChance?: number;
  /** How many ends of the trunk reach the border of the map as outfalls, a `Range` of whole numbers from 0 to 2. One is picked, and the trunk runs a way that allows it. An outfall needs the area to touch the border at an end of the trunk: when fewer than `min` fit, the step throws an ordinary `Error`, which `pipeline` answers with a new map. `{ min: 0, max: 0 }` keeps the sewer off the border. Defaults to `{ min: 1, max: 2 }`. */
  outfalls?: Range;
  /** Whether the water of an outfall breaks through the border: `false` stops it one tile short, at a mouth in the border wall, and `true` runs it onto the border tile, off the map. Defaults to `false`. */
  pierceBorder?: boolean;
  /** How many cisterns each sewer gets, a `Range` of whole numbers of at least 0. One is picked. A cistern is a large chamber at the junction where a branch leaves its parent, or at the head of a branch, with a basin of water in it, so a sewer has at most as many as it has branches; one that finds no room is left out. Defaults to `{ min: 0, max: 0 }`. */
  cisterns?: Range;
  /** The width and the height of a cistern in whole tiles, ledges included, as a `Range`, each side drawn on its own. A side is raised to hold the tunnels that meet there: at a junction as a chamber's is (see `chamberSize`), with a tile more across the parent's tunnel, for the basin; at a head as a chamber's is, and to at least 4 tiles long. Defaults to `{ min: 7, max: 11 }`. */
  cisternSize?: Range;
  /** How many sides of a cistern have a ledge, a `Range` of whole numbers from 1 to 4. One is picked for each cistern, and raised to the ledges its canals need: one where the branch comes into a cistern at its head, and at a junction one along the far side of the parent's water, one where the branch leaves and one between them, so at least 3. The ledges are always sides next to each other, so they make one walkway. Defaults to `{ min: 1, max: 4 }`. */
  cisternLedges?: Range;
  /** The chance that a cistern has columns standing in its water, from 0 to 1. Defaults to 0.5. */
  columnChance?: number;
  /** The water between two columns of a cistern in whole tiles, as a `Range` of at least 1, picked once for each cistern. Defaults to `{ min: 2, max: 3 }`. */
  columnSpacing?: Range;
  /** The size of the part of the map to dig in. Defaults to the whole map. A smaller area goes on a random free spot, and the sewer is closed in by a ring of wall inside it. Its smallest size must hold a trunk: 10 tiles along it and 5 across. */
  area?: AreaSize;
  /** How many sewers to dig, each in an area of its own, a `Range` of whole numbers of at least 0. One is picked. Defaults to `{ min: 1, max: 1 }`. */
  count?: Range;
}
