import { assertFraction } from '../core/assert-fraction';
import { assertRange } from '../core/assert-range';
import { assertWholeNumber } from '../core/assert-whole-number';
import type { ClearingSpec } from './clearing-spec';

/** Throws a `RangeError` unless the clearing is valid and its center is on the map. */
export function assertClearing(
  name: string,
  spec: ClearingSpec,
  width: number,
  height: number,
): void {
  if (spec.at !== undefined && (spec.at as string) !== 'branch-end') {
    throw new RangeError(
      `${name}.at must be 'branch-end', got ${spec.at as string}`,
    );
  }
  if (spec.at !== undefined && (spec.x !== undefined || spec.y !== undefined)) {
    throw new RangeError(
      `${name}.at cannot be combined with ${name}.x and ${name}.y`,
    );
  }
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
  assertRange(`${name}.radiusX`, spec.radiusX, 1);
  if (spec.radiusY !== undefined) {
    assertRange(`${name}.radiusY`, spec.radiusY, 1);
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
