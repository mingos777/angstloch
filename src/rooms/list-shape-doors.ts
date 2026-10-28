import type { RoomShape } from './room-shape';
import { TemplateCell } from './templates/template-cell';
import type { TemplatePlacement } from './templates/template-placement';

/** The door decisions of the `Exit` and `Door` cells of a placement, keyed by `y * mapWidth + x`, as a list in the coordinates of the map. */
export function listShapeDoors(
  placement: TemplatePlacement,
  doors: ReadonlyMap<number, boolean>,
  mapWidth: number,
): RoomShape['doors'] {
  return placement.cells.flatMap((row, dy) =>
    row.flatMap((cell, dx) => {
      const x = placement.x + dx;
      const y = placement.y + dy;
      const door = doors.get(y * mapWidth + x);
      return (cell === TemplateCell.Exit || cell === TemplateCell.Door) &&
        door !== undefined
        ? [{ x, y, door }]
        : [];
    }),
  );
}
