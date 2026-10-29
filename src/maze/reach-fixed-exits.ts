import type { Grid } from '../core/grid';
import type { MazeOpening } from '../rooms/maze-opening';
import { linkMazeCell } from './link-maze-cell';

/**
 * Carves the maze cells in front of the fixed exits of templated rooms where
 * the maze has not reached them, in place, so that the exits lead somewhere.
 * An exit is reached when one of its openings is. Calls `fail` with the room
 * of an exit that cannot be reached.
 */
export function reachFixedExits(
  grid: Grid,
  openings: readonly MazeOpening[],
  isBlocked: (x: number, y: number) => boolean,
  fail: (opening: MazeOpening) => never,
): void {
  const fixed = openings.filter((opening) => opening.fixed);
  for (const opening of fixed) {
    const { wall } = opening;
    const group = fixed.filter(
      (other) => other.wall.x === wall.x && other.wall.y === wall.y,
    );
    if (!group.some((other) => linkMazeCell(grid, other.outside, isBlocked))) {
      fail(opening);
    }
  }
}
