import type { TemplatePlacement } from './templates/template-placement';

/**
 * The shape of a placed room, ordinary or templated: its cells as placed on
 * the map, which say where its walls, its floor and its potential exits are.
 * An ordinary room's shape is a ring of `OptionalExit` around its floor, with
 * wall corners (see `createRoomShape`); a templated room's is its placement.
 */
export interface RoomShape extends TemplatePlacement {
  /** Whether each `Exit` and `Door` cell of the shape got a door, in the coordinates of the map. Empty for an ordinary room. */
  doors: { x: number; y: number; door: boolean }[];
}
