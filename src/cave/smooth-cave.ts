import { caveNeighborOffsets } from './cave-neighbor-offsets';
import type { CaveNeighborhood } from './cave-options';
import { Grid } from '../core/grid';
import { Tile } from '../core/tile';

export interface CaveRules {
  birthLimit: number;
  survivalLimit: number;
  neighborhood: CaveNeighborhood;
  borderWalls: boolean;
}

/** Applies the automaton rules once to every tile at the same time and returns the new grid. */
export function smoothCave(grid: Grid, rules: CaveRules): Grid {
  const { birthLimit, survivalLimit, neighborhood, borderWalls } = rules;
  const offsets = caveNeighborOffsets(neighborhood);
  const next = new Grid(grid.width, grid.height);
  for (let y = 0; y < grid.height; ++y) {
    for (let x = 0; x < grid.width; ++x) {
      const isBorder =
        x === 0 || y === 0 || x === grid.width - 1 || y === grid.height - 1;
      if (borderWalls && isBorder) {
        continue;
      }
      const walls = offsets.filter(
        (offset) => grid.get(x + offset.x, y + offset.y) === Tile.Wall,
      ).length;
      const limit = grid.get(x, y) === Tile.Wall ? survivalLimit : birthLimit;
      next.set(x, y, walls >= limit ? Tile.Wall : Tile.Floor);
    }
  }
  return next;
}
