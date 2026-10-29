import type { CaveGroup } from './cave-group';
import type { CellBlockGroup } from './cell-block-group';
import type { PillarHallsGroup } from './pillar-halls-group';

/** A group of rooms that one copy of a step built together, told apart by its `kind`. A room points to its group with `Room.group`. */
export type RoomGroup = CellBlockGroup | CaveGroup | PillarHallsGroup;
