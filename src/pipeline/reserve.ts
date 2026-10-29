/**
 * What a tile of `MapState#reserved` holds. The numeric values are part of the
 * public contract: new kinds may be added, but existing values never change.
 *
 * `None` is a free tile. `Solid` is a tile that no step digs through, such as
 * the wall or floor of a room. `Openable` is also never dug through, but a step
 * may open it as an exit, which a room's potential exits are.
 */
export const Reserve = {
  None: 0,
  Solid: 1,
  Openable: 2,
} as const;

export type Reserve = (typeof Reserve)[keyof typeof Reserve];
