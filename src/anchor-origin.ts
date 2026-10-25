import type { Position } from './position';
import type { Point } from './point';

/**
 * Returns the top-left corner of a bounding box of the given size that has the
 * position's anchor on its coordinates. Even sizes round the center down.
 */
export function anchorOrigin(
  position: Position,
  width: number,
  height: number,
): Point {
  const { anchor, coords } = position;
  const dx = anchor.endsWith('left')
    ? 0
    : anchor.endsWith('right')
      ? width - 1
      : Math.floor((width - 1) / 2);
  const dy = anchor.startsWith('top')
    ? 0
    : anchor.startsWith('bottom')
      ? height - 1
      : Math.floor((height - 1) / 2);
  return { x: coords.x - dx, y: coords.y - dy };
}
