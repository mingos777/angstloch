import type { CaveLink } from './cave-link';
import type { Grid } from '../core/grid';
import { measureCaveWalk } from './measure-cave-walk';

/** A tunnel is a shortcut when the walk is longer than the gap times this, plus `SHORTCUT_MARGIN`. */
const SHORTCUT_FACTOR = 3;
const SHORTCUT_MARGIN = 4;

/**
 * Tells whether a tunnel between the two ends of a link would be a shortcut:
 * walking over the floor from one end to the other takes much longer (more
 * than three times the gap plus four steps) than the gap itself, which is
 * unbroken rock, or even nothing. The floor must be joined for it to be
 * short, and ends that it does not join count as a long way.
 */
export function isCaveShortcut(grid: Grid, { from, to }: CaveLink): boolean {
  const gap = Math.abs(from.x - to.x) + Math.abs(from.y - to.y);
  return (
    measureCaveWalk(grid, from, to) > SHORTCUT_FACTOR * gap + SHORTCUT_MARGIN
  );
}
