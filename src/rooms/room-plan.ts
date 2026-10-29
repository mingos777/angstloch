import type { Transform } from './templates/create-transforms';
import type { LayoutSymmetry } from '../core/layout-symmetry';
import type { Random } from '../core/random';
import type { Range } from '../core/range';
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
  /** Symmetry of the layout, which is `none` when it is ignored. */
  layout: LayoutSymmetry;
  /** The mirror images of the symmetry, which are none when the layout is not symmetric. */
  transforms: Transform[];
  /** How often a room gets twins, from 0 to 1. */
  symmetryChance: number;
  /** Whether a room's floor is too close to a templated room, or to a tile an exit of one opens onto. Absent without templates. */
  isBlocked?: (room: Pick<Room, 'x' | 'y' | 'width' | 'height'>) => boolean;
}

/**
 * Picks the spots of the ordinary rooms. `seeds` are the boxes, walls
 * included, of rooms there are already that new rooms may be built off, which
 * only `placeClusteredRooms` uses.
 */
export type RoomPlacer = (
  random: Random,
  plan: RoomPlan,
  seeds: readonly Pick<Room, 'x' | 'y' | 'width' | 'height'>[],
) => Room[];

/** Wall tiles between a room's floor and the map edge. */
export const EDGE_CLEARANCE = 1;
