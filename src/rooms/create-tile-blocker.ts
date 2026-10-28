import type { Room } from './room';

/**
 * Returns a test for whether a room's floor is too close to a taken tile: at
 * most `spacing` tiles from it. `taken` holds a byte for each tile, row by
 * row, and anything but 0 is taken. A summed-area table of it answers each
 * test in constant time, however big the room.
 */
export function createTileBlocker(
  taken: Uint8Array,
  width: number,
  height: number,
  spacing: number,
): (room: Pick<Room, 'x' | 'y' | 'width' | 'height'>) => boolean {
  // sums[(y + 1) * stride + x + 1] counts the taken tiles above and left of (x, y), inclusive
  const stride = width + 1;
  const sums = new Uint32Array(stride * (height + 1));
  const sum = (x: number, y: number): number => sums[y * stride + x] ?? 0;
  for (let y = 0; y < height; ++y) {
    let row = 0;
    for (let x = 0; x < width; ++x) {
      row += taken[y * width + x] ? 1 : 0;
      sums[(y + 1) * stride + x + 1] = sum(x + 1, y) + row;
    }
  }
  return (room) => {
    const left = Math.max(0, room.x - spacing);
    const top = Math.max(0, room.y - spacing);
    const right = Math.min(width, room.x + room.width + spacing);
    const bottom = Math.min(height, room.y + room.height + spacing);
    if (left >= right || top >= bottom) {
      return false;
    }
    return (
      sum(right, bottom) -
        sum(right, top) -
        sum(left, bottom) +
        sum(left, top) >
      0
    );
  };
}
