import type { Range } from '../core/range';
import type { AreaWindow } from './area-window';

/**
 * The first and last coordinate a box of `size` may start at along an axis of
 * `limit` tiles so that it stays on the map and its anchor falls in the
 * window (anywhere without one). The range is empty, `min` above `max`, when
 * no spot does.
 */
export function findSpotRange(
  window: AreaWindow<string> | undefined,
  size: number,
  limit: number,
): Range {
  if (!window) {
    return { min: 0, max: limit - size };
  }
  const anchor = window.anchor ?? 'center';
  const offset =
    anchor === 'left' || anchor === 'top'
      ? 0
      : anchor === 'right' || anchor === 'bottom'
        ? size - 1
        : Math.floor(size / 2);
  return {
    min: Math.max(0, window.min - offset),
    max: Math.min(limit - size, window.max - offset),
  };
}
