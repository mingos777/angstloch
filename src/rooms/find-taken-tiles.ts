import { DIRECTIONS } from '../core/directions';
import { isFree } from '../pipeline/is-free';
import type { MapState } from '../pipeline/map-state';
import { Reserve } from '../pipeline/reserve';
import { TemplateCell } from './templates/template-cell';
import type { TemplatePlacement } from './templates/template-placement';

/**
 * The tiles that new rooms keep off, a byte for each tile, row by row: every
 * tile that is not free (see `isFree`), and the tiles in front of the fixed
 * exits of the `shapes` (in the coordinates of the state) that are not opened
 * yet, which a corridor must be able to start on. Returns `undefined` when
 * there are none.
 */
export function findTakenTiles(
  state: Pick<MapState, 'grid' | 'base' | 'prunable' | 'reserved'>,
  shapes: readonly TemplatePlacement[],
): Uint8Array | undefined {
  const { grid } = state;
  const taken = new Uint8Array(grid.width * grid.height);
  const take = (x: number, y: number): void => {
    if (grid.inBounds(x, y)) {
      taken[y * grid.width + x] = 1;
    }
  };
  for (let y = 0; y < grid.height; ++y) {
    for (let x = 0; x < grid.width; ++x) {
      if (!isFree(state, x, y)) {
        take(x, y);
      }
    }
  }
  for (const shape of shapes) {
    for (const exit of shape.exits) {
      const [x, y] = [shape.x + exit.x, shape.y + exit.y];
      if (
        exit.kind === TemplateCell.OptionalExit ||
        !grid.inBounds(x, y) ||
        state.reserved[y * grid.width + x] !== Reserve.Openable
      ) {
        continue;
      }
      for (const direction of exit.directions) {
        const step = DIRECTIONS[direction];
        if (step) {
          take(x + step.x, y + step.y);
        }
      }
    }
  }
  return taken.includes(1) ? taken : undefined;
}
