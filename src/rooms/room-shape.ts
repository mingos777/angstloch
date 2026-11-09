import type { TemplatePlacement } from './templates/template-placement';

/**
 * The shape of a placed room, ordinary or templated: its cells as placed on
 * the map, which say where its walls, its floor and its potential exits are.
 * An ordinary room's shape is a ring of `OptionalExit` around its floor, with
 * wall corners (see `createRoomShape`); a templated room's is its placement.
 */
export interface RoomShape extends TemplatePlacement {
  /** Whether each `Exit`, `Door` and `OptionalExit` cell of the shape gets a door, in the coordinates of the map, decided when the room was placed: an optional exit that a later step opens is a door as its entry says, and one that is never opened stays a wall whatever its entry says. Empty for an ordinary room, whose exits get the `doorChance` of the step that opens them. */
  doors: { x: number; y: number; door: boolean }[];
}
