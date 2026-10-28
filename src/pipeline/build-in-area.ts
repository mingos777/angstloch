import type { Area } from '../core/area';
import { Grid } from '../core/grid';
import type { MapState } from './map-state';

/**
 * Builds in a box of the map. It makes a scratch state the size of the box
 * from a copy of what the box holds (the grid, `prunable` and `reserved`), with
 * the same `base`, runs `build` on it, copies the three back and returns what
 * `build` returned. Coordinates in `build` start at the corner of the box, so
 * the step shifts the extras it returns by the box's `x` and `y` itself. When
 * `build` throws, the map is left as it was.
 */
export function buildInArea<T>(
  state: MapState,
  box: Area,
  build: (scratch: MapState) => T,
): T {
  const { grid, prunable, reserved } = state;
  const scratch: MapState = {
    grid: new Grid(box.width, box.height),
    base: state.base,
    prunable: new Uint8Array(box.width * box.height),
    reserved: new Uint8Array(box.width * box.height),
  };
  const each = (
    visit: (x: number, y: number, inner: number, outer: number) => void,
  ) => {
    for (let y = 0; y < box.height; ++y) {
      for (let x = 0; x < box.width; ++x) {
        visit(x, y, y * box.width + x, (box.y + y) * grid.width + box.x + x);
      }
    }
  };
  each((x, y, inner, outer) => {
    scratch.grid.set(x, y, grid.get(box.x + x, box.y + y));
    scratch.prunable[inner] = prunable[outer] ?? 0;
    scratch.reserved[inner] = reserved[outer] ?? 0;
  });

  const built = build(scratch);

  each((x, y, inner, outer) => {
    grid.set(box.x + x, box.y + y, scratch.grid.get(x, y));
    prunable[outer] = scratch.prunable[inner] ?? 0;
    reserved[outer] = scratch.reserved[inner] ?? 0;
  });
  return built;
}
