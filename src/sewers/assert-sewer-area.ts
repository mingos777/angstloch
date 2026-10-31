import type { Range } from '../core/range';
import type { AreaSize } from '../pipeline/area-size';
import { assertAreaSize } from '../pipeline/assert-area-size';
import { assertWallBase } from '../pipeline/assert-wall-base';
import type { MapState } from '../pipeline/map-state';
import type { DigSewersOptions } from './dig-sewers-options';
import { MIN_SEWER_ACROSS, MIN_SEWER_ALONG } from './sewer-limits';

/**
 * Checks what `digSewers` needs of the map, for its `validate`: the map starts
 * as wall, the `area` and `count` fit the map (see `assertAreaSize`), and the
 * smallest area holds a trunk the way `orientation` allows. Throws a
 * `RangeError`.
 */
export function assertSewerArea(
  state: MapState,
  area: AreaSize,
  count: Range,
  orientation: NonNullable<DigSewersOptions['orientation']>,
): void {
  const { width, height } = state.grid;
  assertWallBase('digSewers', state);
  assertAreaSize(area, count, width, height);
  const smallest = {
    width: area.width?.min ?? width,
    height: area.height?.min ?? height,
  };
  const holds = (along: number, across: number) =>
    along >= MIN_SEWER_ALONG && across >= MIN_SEWER_ACROSS;
  const fits =
    (orientation !== 'vertical' && holds(smallest.width, smallest.height)) ||
    (orientation !== 'horizontal' && holds(smallest.height, smallest.width));
  if (!fits) {
    throw new RangeError(
      `digSewers needs an area of at least ${String(MIN_SEWER_ALONG)} tiles along its trunk and ${String(MIN_SEWER_ACROSS)} across it, got ${String(smallest.width)} by ${String(smallest.height)} with orientation ${orientation}`,
    );
  }
}
