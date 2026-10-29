import { describe, expect, it } from 'vitest';
import { Grid } from '../core/grid';
import { Tile } from '../core/tile';
import { createRoomShape } from './create-room-shape';
import { measureRoomDistances } from './measure-room-distances';
import type { RoomShape } from './room-shape';

/** The shape of an ordinary room with its floor at the box. */
function shapeOf(x: number, y: number, width: number, height: number) {
  return {
    ...createRoomShape({ x, y, width, height }),
    doors: [],
  } satisfies RoomShape;
}

/** A grid of one row, floor where the text has a `.`. */
function rowOf(text: string): Grid {
  const grid = new Grid(text.length, 1);
  text.split('').forEach((symbol, x) => {
    grid.set(x, 0, symbol === '.' ? Tile.Floor : Tile.Wall);
  });
  return grid;
}

describe('measureRoomDistances', () => {
  it('measures between the nearest floor tiles of two rooms', () => {
    // given
    const grid = rowOf('..........');
    const roomShapes = [shapeOf(0, 0, 3, 1), shapeOf(7, 0, 3, 1)];

    // when
    const distances = measureRoomDistances({ grid, roomShapes });

    // then
    expect(distances).toEqual([
      [0, 5],
      [5, 0],
    ]);
  });

  it('indexes the matrix by room id', () => {
    // given
    const grid = rowOf('..........');
    const roomShapes = [
      shapeOf(0, 0, 1, 1),
      shapeOf(9, 0, 1, 1),
      shapeOf(4, 0, 1, 1),
    ];

    // when
    const distances = measureRoomDistances({ grid, roomShapes });

    // then
    expect(distances[0]).toEqual([0, 9, 4]);
  });

  it('gives -1 everywhere for a room with no floor on the map', () => {
    // given
    const grid = rowOf('....');
    const roomShapes = [shapeOf(0, 0, 1, 1), shapeOf(10, 10, 1, 1)];

    // when
    const distances = measureRoomDistances({ grid, roomShapes });

    // then
    expect(distances[1]).toEqual([-1, -1]);
  });

  it('passes the options on to the measuring', () => {
    // given
    const grid = new Grid(2, 2, Tile.Floor);
    const roomShapes = [shapeOf(0, 0, 1, 1), shapeOf(1, 1, 1, 1)];

    // when
    const distances = measureRoomDistances(
      { grid, roomShapes },
      { metric: 'manhattan' },
    );

    // then
    expect(distances[0]?.[1]).toBe(2);
  });

  it('returns an empty matrix for no rooms', () => {
    // given
    const grid = rowOf('...');

    // when
    const distances = measureRoomDistances({ grid, roomShapes: [] });

    // then
    expect(distances).toEqual([]);
  });
});
