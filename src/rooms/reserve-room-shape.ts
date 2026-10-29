import type { MapState } from '../pipeline/map-state';
import { Reserve } from '../pipeline/reserve';
import { reserveTile } from '../pipeline/reserve-tile';
import { TemplateCell } from './templates/template-cell';
import type { TemplatePlacement } from './templates/template-placement';

/**
 * Reserves the footprint of a placed room, so that no later step digs through
 * it: its walls, its floor and its inner doorways are `Solid`, and its
 * potential exits, the `OptionalExit` cells and the `Exit` and `Door` cells
 * that lead outside, are `Openable`. Unused cells are left alone, and so is a
 * tile that is `Solid` already, such as the corner of a room that shares the
 * wall. An exit that is opened afterwards goes through `openReserved`.
 */
export function reserveRoomShape(
  state: Pick<MapState, 'grid' | 'reserved'>,
  shape: TemplatePlacement,
): void {
  const leadsOutside = new Set(
    shape.exits.map(({ x, y }) => y * shape.width + x),
  );
  shape.cells.forEach((row, dy) => {
    row.forEach((cell, dx) => {
      if (cell === TemplateCell.Unused) {
        return;
      }
      const openable =
        cell === TemplateCell.OptionalExit ||
        ((cell === TemplateCell.Exit || cell === TemplateCell.Door) &&
          leadsOutside.has(dy * shape.width + dx));
      const [x, y] = [shape.x + dx, shape.y + dy];
      // a wall that two rooms share stays solid if either room says so
      if (
        openable &&
        state.reserved[y * state.grid.width + x] === Reserve.Solid
      ) {
        return;
      }
      reserveTile(state, x, y, openable ? Reserve.Openable : Reserve.Solid);
    });
  });
}
