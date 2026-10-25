/**
 * Cell kinds of a room template. The numeric values are part of the public
 * contract: new kinds may be added, but existing values never change.
 *
 * - `Unused`: not part of the room. Corridors and other rooms may use the space.
 * - `Floor`: becomes `Tile.Floor`.
 * - `Wall`: becomes `Tile.Wall` and is protected: nothing is dug through it.
 * - `Exit`: a connection point that becomes `Tile.Floor`, or `Tile.Door` by `doorChance`.
 * - `Door`: a connection point that always becomes `Tile.Door`.
 * - `OptionalExit`: a wall that may be opened into an exit, as `Exit` is, when the
 *   room needs one. Where it is not opened it stays `Tile.Wall`.
 */
export const TemplateCell = {
  Unused: 0,
  Floor: 1,
  Wall: 2,
  Exit: 3,
  Door: 4,
  OptionalExit: 5,
} as const;

export type TemplateCell = (typeof TemplateCell)[keyof typeof TemplateCell];
