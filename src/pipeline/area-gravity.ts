/**
 * A pull on where an area goes, the `gravity` of an `AreaSpec`: the box is
 * drawn on a random spot, then slides toward a side, a corner or the middle
 * of the map, and stops against whatever is in the way.
 */
export interface AreaGravity {
  /** Where the box is pulled: flush to a side and centered along it, flush into a corner, or centered both ways (`'center'`). */
  toward:
    | 'left'
    | 'top left'
    | 'top'
    | 'top right'
    | 'right'
    | 'bottom right'
    | 'bottom'
    | 'bottom left'
    | 'center';
  /** The share of the way to the target the box slides, from 0 (it stays where it was drawn) to 1 (all the way, unless something stops it). */
  strength: number;
}
