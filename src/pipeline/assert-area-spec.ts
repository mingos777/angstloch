import { assertFraction } from '../core/assert-fraction';
import { assertRange } from '../core/assert-range';
import type { Range } from '../core/range';
import type { AreaGravity } from './area-gravity';
import type { AreaSpec } from './area-spec';
import type { AreaWindow } from './area-window';
import { findSpotRange } from './find-spot-range';
import { snapToLattice } from './snap-to-lattice';

/** Throws a `RangeError` unless the window is whole numbers with `min <= max`, a known anchor, at least one even coordinate on a `lattice`, and a spot for the largest box the size range draws. */
function assertWindow(
  name: string,
  window: AreaWindow<string>,
  anchors: readonly string[],
  size: Range | undefined,
  limit: number,
  lattice: boolean,
): void {
  for (const end of ['min', 'max'] as const) {
    if (!Number.isInteger(window[end])) {
      throw new RangeError(
        `${name}.${end} must be an integer, got ${String(window[end])}`,
      );
    }
  }
  if (window.min > window.max) {
    throw new RangeError(
      `${name}.min (${String(window.min)}) must not exceed ${name}.max (${String(window.max)})`,
    );
  }
  if (window.anchor !== undefined && !anchors.includes(window.anchor)) {
    throw new RangeError(
      `${name}.anchor must be one of ${anchors.map((anchor) => `'${anchor}'`).join(', ')}, got ${window.anchor}`,
    );
  }
  if (lattice && window.min === window.max && window.min % 2 !== 0) {
    throw new RangeError(
      `${name} (${String(window.min)} to ${String(window.max)}) must hold an even coordinate, since the area is on the lattice`,
    );
  }
  const largest = size
    ? lattice
      ? snapToLattice(size.max, size.min)
      : size.max
    : limit;
  const box = Math.min(largest, limit);
  const spots = findSpotRange(window, box, limit);
  if (spots.min > spots.max) {
    throw new RangeError(
      `${name} (${String(window.min)} to ${String(window.max)}, anchor ${window.anchor ?? 'center'}) has no spot for an area of ${String(box)} tiles on a map of ${String(limit)}`,
    );
  }
}

/** Where gravity may pull. */
const TOWARD: readonly AreaGravity['toward'][] = [
  'left',
  'top left',
  'top',
  'top right',
  'right',
  'bottom right',
  'bottom',
  'bottom left',
  'center',
];

/** Throws a `RangeError` unless the gravity has a known `toward` and a `strength` from 0 to 1, and comes without a window. */
function assertGravity(gravity: AreaGravity, windowed: boolean): void {
  if (windowed) {
    throw new RangeError(
      'area.gravity cannot be used with area.x or area.y: give a window or gravity, not both',
    );
  }
  if (!TOWARD.includes(gravity.toward)) {
    throw new RangeError(
      `area.gravity.toward must be one of ${TOWARD.map((toward) => `'${toward}'`).join(', ')}, got ${gravity.toward}`,
    );
  }
  assertFraction('area.gravity.strength', gravity.strength);
}

/**
 * Checks the `area` and `count` options of a feature step against the size of
 * the map, for the `validate` of the step. Throws a `RangeError` unless the
 * ranges are whole numbers that start at 1 (`count` at 0), an area is no larger
 * than the map, `count` allows more than one copy only where two can fit,
 * which they cannot when every copy is as big as the map, and each window
 * (`x`, `y`) is whole numbers with `min <= max` and a known anchor that leaves
 * a spot for the largest box. With `lattice` (the boxes start on even
 * coordinates), a window must hold an even coordinate. A `gravity` needs a
 * known `toward`, a `strength` from 0 to 1, and no window.
 */
export function assertAreaSpec(
  area: AreaSpec,
  count: Range,
  width: number,
  height: number,
  { lattice = false }: { lattice?: boolean } = {},
): void {
  assertRange('count', count, 0);
  for (const [name, range, limit] of [
    ['area.width', area.width, width],
    ['area.height', area.height, height],
  ] as const) {
    if (range) {
      assertRange(name, range, 1);
      if (range.max > limit) {
        throw new RangeError(
          `${name}.max (${String(range.max)}) must not exceed the size of the map (${String(limit)})`,
        );
      }
    }
  }
  const wholeMap =
    (area.width?.min ?? width) === width &&
    (area.height?.min ?? height) === height;
  if (count.max > 1 && wholeMap) {
    throw new RangeError(
      `count.max (${String(count.max)}) must be 1 when the area is as big as the map, since two copies cannot fit`,
    );
  }
  if (area.x) {
    assertWindow(
      'area.x',
      area.x,
      ['left', 'center', 'right'],
      area.width,
      width,
      lattice,
    );
  }
  if (area.gravity) {
    assertGravity(area.gravity, area.x !== undefined || area.y !== undefined);
  }
  if (area.y) {
    assertWindow(
      'area.y',
      area.y,
      ['top', 'center', 'bottom'],
      area.height,
      height,
      lattice,
    );
  }
}
