import type { Random } from './random';
import type { Range } from './range';
import type { Room } from './room';

/** Everything a room placer needs, with options resolved and validated. */
export interface RoomPlan {
  width: number;
  height: number;
  /** Distance between valid room positions and sizes: 2 on the lattice, otherwise 1. */
  step: number;
  /** Wall tiles between the floors of two rooms, odd on the lattice. */
  spacing: number;
  /** Room widths that are valid and fit the map. */
  widths: Range;
  /** Room heights that are valid and fit the map. */
  heights: Range;
  sizeUniformity: number;
  spacingUniformity: number;
  roomCount: Range;
  fill: number;
}

export type RoomPlacer = (random: Random, plan: RoomPlan) => Room[];

/** Wall tiles between a room's floor and the map edge. */
export const EDGE_CLEARANCE = 1;
