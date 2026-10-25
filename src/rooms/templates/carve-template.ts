import type { Grid } from '../../core/grid';
import { TemplateCell } from './template-cell';
import type { TemplatePlacement } from './template-placement';
import { Tile } from '../../core/tile';

/**
 * Carves a templated room into a grid, in place. Floors become floor tiles,
 * and so do `Exit` and `Door` cells that lead nowhere, which are doors where
 * `doors` says so. Exits that lead outside are left for the builder to open.
 * Walls, optional exits and unused cells are left as they are.
 */
export function carveTemplate(
  grid: Grid,
  placement: TemplatePlacement,
  doors: ReadonlyMap<number, boolean>,
): void {
  placement.cells.forEach((row, dy) => {
    row.forEach((cell, dx) => {
      const [x, y] = [placement.x + dx, placement.y + dy];
      if (cell === TemplateCell.Floor) {
        grid.set(x, y, Tile.Floor);
      } else if (
        (cell === TemplateCell.Exit || cell === TemplateCell.Door) &&
        !placement.exits.some((exit) => exit.x === dx && exit.y === dy)
      ) {
        grid.set(
          x,
          y,
          doors.get(y * grid.width + x) === true ? Tile.Door : Tile.Floor,
        );
      }
    });
  });
}
