import type { Area } from '../core/area';
import type { Point } from '../core/point';

/** A cell block of `placeCellBlocks`: the group of its cells. */
export interface CellBlockGroup {
  kind: 'cellBlock';
  /** The box of the block's cells and corridor, their outer walls included. A guard room and its tunnel lie outside it. */
  footprint: Area;
  /** The floor of the block corridor, which the cell doors open onto. */
  corridor: Area;
  /** The wall tile through which the block is entered: at an end of the corridor, at the far end of the tunnel of a guard room beside it, or in the far wall of a guard room it is entered through. It stays wall, reserved `Openable`, until a joining step opens it. */
  entrance: Point;
  /** The floor of the tunnel that runs from the end of the corridor past the door of the guard room to the entrance. Absent for a block without a guard room beside it. */
  tunnel?: Area;
}
