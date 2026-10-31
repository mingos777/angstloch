import type { Area } from '../core/area';
import type { Range } from '../core/range';

/** The box that spans `along` and `across` on a line that is `horizontal` or not. */
export function lineArea(
  horizontal: boolean,
  along: Range,
  across: Range,
): Area {
  const a = { start: along.min, size: along.max - along.min + 1 };
  const b = { start: across.min, size: across.max - across.min + 1 };
  return horizontal
    ? { x: a.start, y: b.start, width: a.size, height: b.size }
    : { x: b.start, y: a.start, width: b.size, height: a.size };
}
