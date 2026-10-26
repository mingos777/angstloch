import type { Point } from '../core/point';

/** What every passage needs, wherever it goes. */
interface PassageBase {
  /** The tile where the passage starts. */
  from: Point;
  /** Width in tiles. */
  width: number;
  /** How much the passage winds, from 0 (straight) to 1. */
  windiness: number;
  /** Which of the bends of the noise this passage follows, so that every passage gets a different pattern of bends. */
  lane: number;
}

/** A passage that ends at a given tile. */
export interface PassageBetween extends PassageBase {
  /** The tile where the passage ends. */
  to: Point;
}

/** A passage that heads off in a direction. */
export interface PassageTowards extends PassageBase {
  /** Direction in radians, clockwise from east. */
  angle: number;
  /** Which ways to go from the start: 1 forwards, -1 backwards. Both makes a passage that runs through the start. Defaults to forwards. */
  directions?: readonly (1 | -1)[];
  /** Stops after this many tiles in each direction. Defaults to running until the passage leaves the map. */
  length?: number;
}

/** Where a passage goes: between two tiles, or from one tile in a direction. */
export type PassageSpec = PassageBetween | PassageTowards;
