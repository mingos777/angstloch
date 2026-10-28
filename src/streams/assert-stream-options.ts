import { assertFraction } from '../core/assert-fraction';
import { assertRange } from '../core/assert-range';
import { assertWholeNumber } from '../core/assert-whole-number';
import { assertDegrees } from '../roads/assert-degrees';
import type { StreamOptions } from './stream-options';

/** Throws a `RangeError` unless the stream options are valid. */
export function assertStreamOptions(options: StreamOptions): void {
  const { angle = 'random', windiness, width, shoreWidth } = options;
  if (angle !== 'random' && !Number.isFinite(angle)) {
    throw new RangeError(
      `streams.angle must be a finite number or 'random', got ${String(angle)}`,
    );
  }
  if (windiness !== undefined) {
    assertFraction('streams.windiness', windiness);
  }
  if (width) {
    assertRange('streams.width', width, 1);
  }
  for (const [name, range] of [
    ['streams.tributaryWidth', options.tributaryWidth],
    ['streams.tributaryLength', options.tributaryLength],
  ] as const) {
    if (range) {
      assertRange(name, range, 1);
    }
  }
  if (options.tributaries) {
    assertRange('streams.tributaries', options.tributaries, 0);
  }
  if (options.tributaryAngle) {
    assertDegrees('streams.tributaryAngle', options.tributaryAngle);
  }
  if (shoreWidth !== undefined) {
    assertWholeNumber('streams.shoreWidth', shoreWidth, 0);
  }
}
