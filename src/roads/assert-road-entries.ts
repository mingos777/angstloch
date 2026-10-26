import { assertFraction } from '../core/assert-fraction';
import { assertWholeNumber } from '../core/assert-whole-number';
import type { Point } from '../core/point';
import type { RoadEntry } from './road-entry';

function assertPoint(name: string, point: Point): void {
  if (!Number.isFinite(point.x) || !Number.isFinite(point.y)) {
    throw new RangeError(
      `${name} must have finite x and y, got (${String(point.x)}, ${String(point.y)})`,
    );
  }
}

/** Throws a `RangeError` unless the road entries are valid. */
export function assertRoadEntries(entries: readonly RoadEntry[]): void {
  entries.forEach((entry, index) => {
    const name = `roads.specs[${String(index)}]`;
    const { kind, width, windiness, parent, at, origin, angle, length, to } =
      entry;
    // the type says so, but callers may be plain JavaScript
    const given: string | undefined = kind;
    if (given !== undefined && given !== 'road' && given !== 'branch') {
      throw new RangeError(
        `${name}.kind must be 'road' or 'branch', got ${String(kind)}`,
      );
    }
    if (width !== undefined) {
      assertWholeNumber(`${name}.width`, width, 1);
    }
    if (windiness !== undefined) {
      assertFraction(`${name}.windiness`, windiness);
    }
    if (parent !== undefined) {
      assertWholeNumber(`${name}.parent`, parent, 0);
      if (parent >= index) {
        throw new RangeError(
          `${name}.parent must be the index of an earlier entry, got ${String(parent)}`,
        );
      }
    }
    if (at !== undefined) {
      assertFraction(`${name}.at`, at);
    }
    if (origin) {
      assertPoint(`${name}.origin`, origin);
    }
    if (angle !== undefined && !Number.isFinite(angle)) {
      throw new RangeError(
        `${name}.angle must be a finite number, got ${String(angle)}`,
      );
    }
    if (length !== undefined) {
      assertWholeNumber(`${name}.length`, length, 1);
    }
    if (to) {
      assertPoint(`${name}.to`, to);
      if (parent === undefined && !origin) {
        throw new RangeError(`${name}.to needs an origin or a parent`);
      }
    }
  });
}
