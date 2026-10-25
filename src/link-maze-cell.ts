import type { Grid } from './grid';
import type { Point } from './point';
import { Tile } from './tile';

const STEPS: readonly Point[] = [
  { x: 0, y: -2 },
  { x: 2, y: 0 },
  { x: 0, y: 2 },
  { x: -2, y: 0 },
];

/**
 * Makes sure a maze cell is carved and joined to the maze, in place, by
 * carving the shortest passage from it to a cell that is carved already. The
 * passage avoids blocked tiles. Returns `false`, and carves nothing, when no
 * carved cell can be reached.
 */
export function linkMazeCell(
  grid: Grid,
  cell: Point,
  isBlocked: (x: number, y: number) => boolean,
): boolean {
  if (grid.get(cell.x, cell.y) === Tile.Floor) {
    return true;
  }
  const key = ({ x, y }: Point): number => y * grid.width + x;
  const from = new Map<number, Point>();
  const queue = [cell];
  from.set(key(cell), cell);
  for (let current = queue.shift(); current; current = queue.shift()) {
    for (const step of STEPS) {
      const next = { x: current.x + step.x, y: current.y + step.y };
      if (
        next.x < 1 ||
        next.y < 1 ||
        next.x > grid.width - 2 ||
        next.y > grid.height - 2 ||
        from.has(key(next)) ||
        isBlocked(next.x, next.y) ||
        isBlocked(current.x + step.x / 2, current.y + step.y / 2)
      ) {
        continue;
      }
      from.set(key(next), current);
      if (grid.get(next.x, next.y) === Tile.Floor) {
        // walk back to the start of the search, carving as we go
        for (let tile = next; tile !== cell;) {
          const previous = from.get(key(tile)) ?? cell;
          grid.set(tile.x, tile.y, Tile.Floor);
          grid.set(
            (tile.x + previous.x) / 2,
            (tile.y + previous.y) / 2,
            Tile.Floor,
          );
          tile = previous;
        }
        grid.set(cell.x, cell.y, Tile.Floor);
        return true;
      }
      queue.push(next);
    }
  }
  return false;
}
