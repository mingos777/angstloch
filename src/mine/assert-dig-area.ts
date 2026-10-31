import type { Range } from '../core/range';
import type { AreaSpec } from '../pipeline/area-spec';
import { assertAreaSpec } from '../pipeline/assert-area-spec';
import type { MapState } from '../pipeline/map-state';
import { assertWallBase } from '../pipeline/assert-wall-base';

/**
 * Checks what a mine layout step needs of the map, for its `validate`: the map
 * starts as wall, since a mine is dug out of rock, and the `area` and `count`
 * fit the map (see `assertAreaSpec`). Throws a `RangeError`.
 */
export function assertDigArea(
  name: string,
  state: MapState,
  area: AreaSpec,
  count: Range,
): void {
  assertWallBase(name, state);
  assertAreaSpec(area, count, state.grid.width, state.grid.height);
}
