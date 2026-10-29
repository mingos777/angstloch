import { describe, expect, it } from 'vitest';
import { Grid } from '../core/grid';
import type { Point } from '../core/point';
import { Tile } from '../core/tile';
import { addFeatureRoom } from './add-feature-room';
import { createRoomShape } from './create-room-shape';
import type { FeatureRooms } from './feature-rooms';
import { recordDugEntries } from './record-dug-entries';
import type { Room } from './room';

/** A map of wall with floor on the tiles. */
function mapOf(floor: readonly Point[]): Grid {
  const grid = new Grid(12, 10);
  for (const { x, y } of floor) {
    grid.set(x, y, Tile.Floor);
  }
  return grid;
}

/** The tiles of a box. */
function box(x: number, y: number, width: number, height: number): Point[] {
  return Array.from({ length: width * height }, (_, i) => ({
    x: x + (i % width),
    y: y + Math.floor(i / width),
  }));
}

/** Caverns on the tiles, one per list. */
function caverns(...floors: Point[][]): FeatureRooms {
  const into: FeatureRooms = { rooms: [], roomShapes: [], roomGroups: [] };
  for (const floor of floors) {
    addFeatureRoom(into, 'cavern', 0, floor);
  }
  return into;
}

/** An ordinary room with its floor at (6, 3), 3 by 3, after the caverns. */
function withRoom(into: FeatureRooms): FeatureRooms {
  const area = { x: 6, y: 3, width: 3, height: 3 };
  into.rooms.push({
    id: into.rooms.length,
    kind: 'room',
    ...area,
    exits: [],
    exitCount: 0,
    doorCount: 0,
  });
  into.roomShapes.push({ ...createRoomShape(area), doors: [] });
  return into;
}

/** Records what was dug between the maps, into every room. */
function record(
  before: Grid,
  grid: Grid,
  into: FeatureRooms,
  roomExits = [] as ReturnType<typeof recordDugEntries>['roomExits'],
  first = 0,
) {
  return recordDugEntries(
    before,
    grid,
    Tile.Wall,
    { rooms: into.rooms, roomExits },
    into.roomShapes,
    into.rooms,
    first,
  );
}

describe('recordDugEntries', () => {
  it('records a dug tile that touches the floor of a cavern as its exit', () => {
    // given
    const floor = box(2, 2, 3, 2);
    const before = mapOf(floor);
    const grid = mapOf([...floor, { x: 5, y: 2 }, { x: 6, y: 2 }]);

    // when
    const { rooms, roomExits } = record(before, grid, caverns(floor));

    // then
    expect(roomExits).toEqual([
      { position: { x: 5, y: 2 }, rooms: [0], door: false },
    ]);
    expect(rooms[0]).toMatchObject({ exits: [0], exitCount: 1, doorCount: 0 });
  });

  it('makes one exit of a wide way in', () => {
    // given
    const floor = box(2, 2, 3, 2);
    const before = mapOf(floor);
    const grid = mapOf([...floor, ...box(5, 2, 2, 2)]);

    // when
    const { roomExits } = record(before, grid, caverns(floor));

    // then
    expect(roomExits).toEqual([
      { position: { x: 5, y: 2 }, rooms: [0], door: false },
    ]);
  });

  it('makes two exits of two ways in apart', () => {
    // given
    const floor = box(2, 2, 3, 3);
    const before = mapOf(floor);
    const grid = mapOf([...floor, { x: 5, y: 2 }, { x: 5, y: 4 }]);

    // when
    const { rooms, roomExits } = record(before, grid, caverns(floor));

    // then
    expect(roomExits.map(({ position }) => position)).toEqual([
      { x: 5, y: 2 },
      { x: 5, y: 4 },
    ]);
    expect(rooms[0]?.exitCount).toBe(2);
  });

  it('records a door where the way in is one', () => {
    // given
    const floor = box(2, 2, 3, 2);
    const before = mapOf(floor);
    const grid = mapOf(floor);
    grid.set(5, 2, Tile.Door);

    // when
    const { rooms, roomExits } = record(before, grid, caverns(floor));

    // then
    expect(roomExits[0]?.door).toBe(true);
    expect(rooms[0]?.doorCount).toBe(1);
  });

  it('makes one exit of both caverns that a single tile joins', () => {
    // given
    const left = box(2, 2, 3, 2);
    const right = box(6, 2, 3, 2);
    const before = mapOf([...left, ...right]);
    const grid = mapOf([...left, ...right, { x: 5, y: 2 }]);

    // when
    const { rooms, roomExits } = record(before, grid, caverns(left, right));

    // then
    expect(roomExits).toEqual([
      { position: { x: 5, y: 2 }, rooms: [0, 1], door: false },
    ]);
    expect(rooms.map(({ exits }) => exits)).toEqual([[0], [0]]);
  });

  it('records an opened wall in the shape of an ordinary room as its exit', () => {
    // given
    const into = withRoom(caverns());
    const floor = box(6, 3, 3, 3);
    const before = mapOf(floor);
    const grid = mapOf([...floor, { x: 5, y: 4 }, { x: 4, y: 4 }]);

    // when
    const { rooms, roomExits } = record(before, grid, into);

    // then
    expect(roomExits).toEqual([
      { position: { x: 5, y: 4 }, rooms: [0], door: false },
    ]);
    expect(rooms[0]?.exitCount).toBe(1);
  });

  it('gives a cavern an exit of its own beside the exit of a room', () => {
    // given
    const into = withRoom(caverns(box(2, 3, 2, 3)));
    const floor = [...box(2, 3, 2, 3), ...box(6, 3, 3, 3)];
    const before = mapOf(floor);
    const grid = mapOf([...floor, { x: 4, y: 4 }, { x: 5, y: 4 }]);
    const made = { position: { x: 5, y: 4 }, rooms: [1], door: false };
    into.rooms[1] = { ...(into.rooms[1] as Room), exits: [0], exitCount: 1 };

    // when
    const { rooms, roomExits } = recordDugEntries(
      before,
      grid,
      Tile.Wall,
      { rooms: into.rooms, roomExits: [made] },
      into.roomShapes,
      [into.rooms[0] as Room],
      0,
    );

    // then
    expect(roomExits).toEqual([
      { position: { x: 5, y: 4 }, rooms: [1], door: false },
      { position: { x: 4, y: 4 }, rooms: [0], door: false },
    ]);
    expect(rooms.map(({ exits }) => exits)).toEqual([[1], [0]]);
  });

  it('joins an exit the step made at the same tile', () => {
    // given
    const floor = box(2, 2, 3, 2);
    const before = mapOf(floor);
    const grid = mapOf([...floor, { x: 5, y: 2 }]);
    const earlier = { position: { x: 0, y: 0 }, rooms: [], door: false };
    const made = { position: { x: 5, y: 2 }, rooms: [], door: false };

    // when
    const { roomExits } = record(
      before,
      grid,
      caverns(floor),
      [earlier, made],
      1,
    );

    // then
    expect(roomExits).toEqual([
      earlier,
      { position: { x: 5, y: 2 }, rooms: [0], door: false },
    ]);
  });

  it('leaves an exit before the first alone', () => {
    // given
    const floor = box(2, 2, 3, 2);
    const before = mapOf(floor);
    const grid = mapOf([...floor, { x: 5, y: 2 }]);
    const earlier = { position: { x: 5, y: 2 }, rooms: [], door: false };

    // when
    const { roomExits } = record(before, grid, caverns(floor), [earlier], 1);

    // then
    expect(roomExits).toEqual([
      earlier,
      { position: { x: 5, y: 2 }, rooms: [0], door: false },
    ]);
  });

  it('records nothing where nothing was dug', () => {
    // given
    const floor = [...box(2, 2, 3, 2), { x: 5, y: 2 }];
    const grid = mapOf(floor);

    // when
    const { rooms, roomExits } = record(grid.clone(), grid, caverns(floor));

    // then
    expect(roomExits).toEqual([]);
    expect(rooms[0]?.exitCount).toBe(0);
  });

  it('leaves out the rooms it is not given', () => {
    // given
    const floor = box(2, 2, 3, 2);
    const into = caverns(floor);
    const before = mapOf(floor);
    const grid = mapOf([...floor, { x: 5, y: 2 }]);

    // when
    const { rooms, roomExits } = recordDugEntries(
      before,
      grid,
      Tile.Wall,
      { rooms: into.rooms, roomExits: [] },
      into.roomShapes,
      [],
      0,
    );

    // then
    expect(roomExits).toEqual([]);
    expect(rooms).toEqual(into.rooms);
  });

  it('does not change the rooms and exits it is given', () => {
    // given
    const floor = box(2, 2, 3, 2);
    const into = caverns(floor);
    const before = mapOf(floor);
    const grid = mapOf([...floor, { x: 5, y: 2 }]);
    const made = { position: { x: 5, y: 2 }, rooms: [], door: false };

    // when
    record(before, grid, into, [made]);

    // then
    expect(made.rooms).toEqual([]);
    expect(into.rooms[0]?.exits).toEqual([]);
  });
});
