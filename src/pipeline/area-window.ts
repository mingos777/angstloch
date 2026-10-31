/**
 * Where an area may go along one axis, the `x` or `y` of an `AreaSpec`: the
 * `anchor` point of the box must fall between `min` and `max`, tiles in map
 * coordinates, both inclusive.
 */
export interface AreaWindow<Anchor extends string> {
  /** The first tile the anchor may fall on, a whole number. */
  min: number;
  /** The last tile the anchor may fall on, a whole number of at least `min`. */
  max: number;
  /** The point of the box that must fall in the window: its first tile (`left` or `top`), its last tile (`right` or `bottom`) or its center tile (`x + floor(width / 2)`). Defaults to `center`. */
  anchor?: Anchor;
}
