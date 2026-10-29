import type { Range } from '../core/range';
import type { AreaSize } from '../pipeline/area-size';
import type { Placement } from './dungeon-options';

/** Options of the guard room of a cell block. */
export interface GuardRoomOptions {
  /** The chance that a block gets a guard room, from 0 to 1. Defaults to 1. */
  chance?: number;
  /** The size of its floor in whole tiles of at least 1: `width` along the tunnel and `depth` away from it. Defaults to `{ width: { min: 5, max: 5 }, depth: { min: 3, max: 3 } }`. */
  size?: { width?: Range; depth?: Range };
  /** Where it stands: `'beside'`, next to a tunnel that leads from the end of the block corridor past its door, on either side, or `'through'`, against the end of the block, with its door at the end of the corridor and the entrance opposite in its far wall, its floor centered on that row, or `'any'`, either of them drawn for each guard room. Defaults to `'beside'`. */
  placement?: 'beside' | 'through' | 'any';
  /** How many tiles the tunnel runs past the door of the guard room before the entrance, a `Range` of whole numbers of at least 0. Only for a guard room beside the block. Defaults to `{ min: 2, max: 4 }`. */
  tunnel?: Range;
}

/** Options of `placeCellBlocks`. */
export interface PlaceCellBlocksOptions {
  /** How many blocks to place in each area, a `Range` of whole numbers of at least 0. One is picked for each area. Defaults to `{ min: 1, max: 1 }`. */
  blocks?: Range;
  /** The size of the floor of a cell, in whole tiles of at least 1: `width` along the corridor and `depth` away from it. Each is drawn once per block, so the cells of a block are alike. Defaults to `{ width: { min: 3, max: 3 }, depth: { min: 3, max: 3 } }`. */
  cellSize?: { width?: Range; depth?: Range };
  /** How many cells line each side of the corridor, a `Range` of whole numbers of at least 1, drawn once per block. Defaults to `{ min: 4, max: 6 }`. */
  cellsPerSide?: Range;
  /** On how many sides of the corridor the cells are, a `Range` of 1 to 2, drawn once per block. A block of one side has its cells on either side at random. Defaults to `{ min: 2, max: 2 }`. */
  sides?: Range;
  /** The width of the block corridor in whole tiles of at least 1, drawn once per block. Defaults to `{ min: 1, max: 1 }`. */
  corridorWidth?: Range;
  /** Which way the corridor runs: `'horizontal'`, `'vertical'`, or `'any'`, drawn for each block. Defaults to `'any'`. */
  orientation?: 'horizontal' | 'vertical' | 'any';
  /** Where the door of a cell sits along its front: `'centered'`, or `'jittered'`, at a spot drawn once per block that all its cells share. Defaults to `'centered'`. */
  cellDoors?: 'centered' | 'jittered';
  /** `'free'`, or `'lattice'`, which puts the walls of a block, its guard room and its tunnel on even coordinates and their floors on odd ones, the tile beyond the entrance included, so that the corridors of a lattice dungeon reach it: the cell sizes, the corridor width, the guard room's size and the tunnel's length are narrowed to odd numbers (an even-only range is rounded up), and the guard room shares the block's end wall. Takes nothing from the other steps: give it to every step of a lattice dungeon. Defaults to `'free'`. */
  placement?: Placement;
  /** A guard room for each block, a room of kind `'guardRoom'` in the group of its block. Absent means none. */
  guardRoom?: GuardRoomOptions;
  /** The size of the part of the map to place blocks in. Defaults to the whole map. A smaller area goes on a random free spot. */
  area?: AreaSize;
  /** How many areas to place blocks in, a `Range` of whole numbers of at least 0. One is picked. Defaults to `{ min: 1, max: 1 }`. */
  count?: Range;
}
