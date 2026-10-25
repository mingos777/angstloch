import type { NoiseFunction } from './noise-function';
import type { NoiseTransformOptions } from './noise-transform-options';

function assertScale(name: string, value: number): void {
  if (!(value > 0 && Number.isFinite(value))) {
    throw new RangeError(
      `${name} must be a positive number, got ${String(value)}`,
    );
  }
}

/**
 * Turns noise into a function of tile positions. Positions are first rotated
 * clockwise about the origin and then divided by the scales, so shapes get
 * stretched along the rotated axes. Positions with a y that grows downwards
 * are assumed, like everywhere else in the library.
 */
export function transformNoise(
  noise: NoiseFunction,
  options: NoiseTransformOptions = {},
): NoiseFunction {
  const { scaleX = 1, scaleY = 1, rotation = 0 } = options;
  assertScale('scaleX', scaleX);
  assertScale('scaleY', scaleY);
  if (!Number.isFinite(rotation)) {
    throw new RangeError(
      `rotation must be a finite number, got ${String(rotation)}`,
    );
  }

  const angle = (rotation * Math.PI) / 180;
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  return (x, y) =>
    noise((x * cos + y * sin) / scaleX, (y * cos - x * sin) / scaleY);
}
