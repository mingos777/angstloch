import { Tile } from '../core/tile';
import { TemplateCell } from '../rooms/templates/template-cell';

/** The tile a template cell forces on a forest, or nothing for a cell that leaves the map as it is. */
export function templateTile(cell: TemplateCell): Tile | undefined {
  switch (cell) {
    case TemplateCell.Floor:
      return Tile.Floor;
    case TemplateCell.Wall:
      return Tile.Wall;
    default:
      return undefined;
  }
}
