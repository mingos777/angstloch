import type { Range } from '../core/range';
import type { AreaSize } from '../pipeline/area-size';
import { assertAreaSize } from '../pipeline/assert-area-size';
import type { MapState } from '../pipeline/map-state';
import { assertWallBase } from '../pipeline/assert-wall-base';

/**
 * Checks what a mine layout step needs of the map, for its `validate`: the map
 * starts as wall, since a mine is dug out of rock, and the `area` and `count`
 * fit the map (see `assertAreaSize`). Throws a `RangeError`.
 */
export function assertDigArea(
  name: string,
  state: MapState,
  area: AreaSize,
  count: Range,
): void {
  assertWallBase(name, state);
  assertAreaSize(area, count, state.grid.width, state.grid.height);
}
