import { assertFraction } from '../core/assert-fraction';
import { assertRange } from '../core/assert-range';
import { assertWholeNumber } from '../core/assert-whole-number';
import type { ClearingSpec } from './clearing-spec';

/** Throws a `RangeError` unless the number is finite and above 0. */
function assertPositive(name: string, value: number): void {
  if (!(Number.isFinite(value) && value > 0)) {
    throw new RangeError(
      `${name} must be a positive number, got ${String(value)}`,
    );
  }
}

/** Throws a `RangeError` unless the clearing is valid and its center is on the map. */
export function assertClearing(
  name: string,
  spec: ClearingSpec,
  width: number,
  height: number,
): void {
  if ((spec.x === undefined) !== (spec.y === undefined)) {
    throw new RangeError(
      `${name}.x and ${name}.y must be given together or both left out`,
    );
  }
  if (spec.x !== undefined && spec.y !== undefined) {
    assertWholeNumber(`${name}.x`, spec.x, 0);
    assertWholeNumber(`${name}.y`, spec.y, 0);
    if (spec.x >= width || spec.y >= height) {
      throw new RangeError(
        `${name} must be inside the ${String(width)}x${String(height)} map, got ${String(spec.x)},${String(spec.y)}`,
      );
    }
  }
  assertPositive(`${name}.radiusX`, spec.radiusX);
  if (spec.radiusY !== undefined) {
    assertPositive(`${name}.radiusY`, spec.radiusY);
  }
  if (spec.angle !== undefined && !Number.isFinite(spec.angle)) {
    throw new RangeError(
      `${name}.angle must be a finite number, got ${String(spec.angle)}`,
    );
  }
  if (spec.irregularity !== undefined) {
    assertFraction(`${name}.irregularity`, spec.irregularity);
  }
  if (spec.roadDistance !== undefined) {
    assertRange(`${name}.roadDistance`, spec.roadDistance, 0);
  }
  if (typeof spec.path === 'object') {
    if (spec.path.width !== undefined) {
      assertWholeNumber(`${name}.path.width`, spec.path.width, 1);
    }
    if (spec.path.windiness !== undefined) {
      assertFraction(`${name}.path.windiness`, spec.path.windiness);
    }
  }
}
