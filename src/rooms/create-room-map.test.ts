import { describe, expect, it } from 'vitest';
import { createRoomMap } from './create-room-map';
import { createRoomShape } from './create-room-shape';
import type { RoomShape } from './room-shape';

/** The shape of an ordinary room with its floor at the box. */
function shapeOf(x: number, y: number, width: number, height: number) {
  return {
    ...createRoomShape({ x, y, width, height }),
    doors: [],
  } satisfies RoomShape;
}

describe('createRoomMap', () => {
  it('gives every tile of a room’s floor the room’s id', () => {
    // given
    const roomShapes = [shapeOf(1, 1, 2, 2), shapeOf(5, 1, 1, 1)];

    // when
    const map = createRoomMap({ grid: { width: 8, height: 4 }, roomShapes });

    // then
    expect([...map]).toEqual([
      ...[-1, -1, -1, -1, -1, -1, -1, -1],
      ...[-1, 0, 0, -1, -1, 1, -1, -1],
      ...[-1, 0, 0, -1, -1, -1, -1, -1],
      ...[-1, -1, -1, -1, -1, -1, -1, -1],
    ]);
  });

  it('leaves out a room’s walls and potential exits', () => {
    // given
    const roomShapes = [shapeOf(1, 1, 1, 1)];

    // when
    const map = createRoomMap({ grid: { width: 3, height: 3 }, roomShapes });

    // then
    expect([...map].filter((id) => id === -1)).toHaveLength(8);
  });

  it('leaves out the part of a shape outside the map', () => {
    // given
    const roomShapes = [shapeOf(-1, -1, 3, 3)];

    // when
    const map = createRoomMap({ grid: { width: 2, height: 2 }, roomShapes });

    // then
    expect([...map]).toEqual([0, 0, 0, 0]);
  });
});
