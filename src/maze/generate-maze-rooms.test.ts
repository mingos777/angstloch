import { describe, expect, it } from 'vitest';
import { generateMaze } from './generate-maze';
import type { MazeOptions } from './maze-options';
import type { MazeResult } from './maze-result';
import type { Point } from '../core/point';
import type { Room } from '../rooms/room';
import { mulberry32 } from '../test-helpers/mulberry32';
import { Tile } from '../core/tile';

const NEIGHBORS: readonly Point[] = [
  { x: 0, y: -1 },
  { x: 1, y: 0 },
  { x: 0, y: 1 },
  { x: -1, y: 0 },
];

const SEEDS = Array.from({ length: 20 }, (_, i) => i + 1);

function maze(options: Partial<MazeOptions> = {}, seed = 1) {
  return generateMaze({
    width: 41,
    height: 31,
    random: mulberry32(seed),
    rooms: { count: { min: 3, max: 3 } },
    ...options,
  });
}

function contains(room: Room, { x, y }: Point) {
  return (
    x >= room.x &&
    x < room.x + room.width &&
    y >= room.y &&
    y < room.y + room.height
  );
}

/** Counts the passable tiles reachable from `from`. */
function reachable(result: MazeResult, from: Point) {
  const { grid } = result;
  const seen = new Set([`${String(from.x)},${String(from.y)}`]);
  const queue = [from];
  for (let point = queue.shift(); point; point = queue.shift()) {
    for (const n of NEIGHBORS) {
      const next = { x: point.x + n.x, y: point.y + n.y };
      const key = `${String(next.x)},${String(next.y)}`;
      if (grid.get(next.x, next.y) !== Tile.Wall && !seen.has(key)) {
        seen.add(key);
        queue.push(next);
      }
    }
  }
  return seen.size;
}

function passable(result: MazeResult) {
  const { grid } = result;
  let count = 0;
  for (let y = 0; y < grid.height; ++y) {
    for (let x = 0; x < grid.width; ++x) {
      if (grid.get(x, y) !== Tile.Wall) {
        ++count;
      }
    }
  }
  return count;
}

describe('generateMaze with rooms', () => {
  it('places no rooms unless asked to', () => {
    // given
    const options = { rooms: undefined };

    // when
    const result = maze(options);

    // then
    expect(result.rooms).toEqual([]);
    expect(result.roomExits).toEqual([]);
  });

  it('places the requested number of rooms', () => {
    // given
    const rooms = { count: { min: 4, max: 4 }, width: { min: 3, max: 3 } };

    // when
    const result = maze({ rooms });

    // then
    expect(result.rooms).toHaveLength(4);
  });

  it('draws the room count from the range', () => {
    // given
    const rooms = { count: { min: 1, max: 4 } };

    // when
    const counts = SEEDS.map((seed) => maze({ rooms }, seed).rooms.length);

    // then
    expect(Math.min(...counts)).toBeGreaterThanOrEqual(1);
    expect(Math.max(...counts)).toBeLessThanOrEqual(4);
    expect(new Set(counts).size).toBeGreaterThan(1);
  });

  it('places no rooms when the count is 0', () => {
    // given
    const rooms = { count: { min: 0, max: 0 } };

    // when
    const result = maze({ rooms });

    // then
    expect(result.rooms).toEqual([]);
  });

  it('places no rooms when none fit the map', () => {
    // given
    const rooms = { width: { min: 99, max: 99 } };

    // when
    const result = maze({ rooms });

    // then
    expect(result.rooms).toEqual([]);
  });

  it('puts rooms on the lattice, with odd sizes', () => {
    // given
    const rooms = { width: { min: 3, max: 8 }, height: { min: 3, max: 8 } };

    // when
    const result = maze({ rooms });

    // then
    for (const room of result.rooms) {
      expect([room.x % 2, room.y % 2]).toEqual([1, 1]);
      expect([room.width % 2, room.height % 2]).toEqual([1, 1]);
    }
  });

  it('keeps room sizes within the ranges', () => {
    // given
    const rooms = {
      count: { min: 3, max: 3 },
      width: { min: 5, max: 5 },
      height: { min: 3, max: 3 },
    };

    // when
    const result = maze({ rooms });

    // then
    expect(result.rooms.map(({ width, height }) => [width, height])).toEqual([
      [5, 3],
      [5, 3],
      [5, 3],
    ]);
  });

  it('numbers the rooms in the order they were placed', () => {
    // given
    const options = {};

    // when
    const result = maze(options);

    // then
    expect(result.rooms.map(({ id }) => id)).toEqual([0, 1, 2]);
  });

  it('turns the whole floor of every room into floor tiles', () => {
    // given
    const options = {};

    // when
    const { grid, rooms } = maze(options);

    // then
    for (const room of rooms) {
      for (let y = room.y; y < room.y + room.height; ++y) {
        for (let x = room.x; x < room.x + room.width; ++x) {
          expect(grid.get(x, y)).toBe(Tile.Floor);
        }
      }
    }
  });

  it('leaves at least three wall tiles between the floors of two rooms', () => {
    // given
    const rooms = { count: { min: 8, max: 8 } };

    // when
    const results = SEEDS.map((seed) => maze({ rooms }, seed).rooms);

    // then
    for (const placed of results) {
      for (const a of placed) {
        for (const b of placed.filter(({ id }) => id > a.id)) {
          const apartX = a.x >= b.x + b.width + 3 || b.x >= a.x + a.width + 3;
          const apartY = a.y >= b.y + b.height + 3 || b.y >= a.y + a.height + 3;
          expect(apartX || apartY).toBe(true);
        }
      }
    }
  });

  it('keeps rooms off the start cell', () => {
    // given
    const start = { x: 9, y: 9 };
    const rooms = { count: { min: 6, max: 6 } };

    // when
    const results = SEEDS.map((seed) => maze({ start, rooms }, seed));

    // then
    for (const result of results) {
      expect(result.start).toEqual(start);
      expect(result.rooms.some((room) => contains(room, start))).toBe(false);
    }
  });

  it('starts outside the rooms when the middle is taken', () => {
    // given
    const rooms = {
      count: { min: 1, max: 1 },
      width: { min: 31, max: 31 },
      height: { min: 21, max: 21 },
    };

    // when
    const result = maze({ rooms });

    // then
    expect(result.rooms).toHaveLength(1);
    expect(result.rooms.some((room) => contains(room, result.start))).toBe(
      false,
    );
    expect(result.grid.get(result.start.x, result.start.y)).toBe(Tile.Floor);
  });

  it('opens every room onto the maze', () => {
    // given
    const rooms = { count: { min: 5, max: 5 } };

    // when
    const results = SEEDS.map((seed) => maze({ rooms }, seed));

    // then
    for (const result of results) {
      for (const room of result.rooms) {
        expect(room.exitCount).toBeGreaterThanOrEqual(1);
        expect(room.exits).toHaveLength(room.exitCount);
      }
    }
  });

  it('reports exits in the wall of the room they belong to', () => {
    // given
    const options = {};

    // when
    const { grid, rooms, roomExits } = maze(options);

    // then
    expect(roomExits.length).toBeGreaterThan(0);
    for (const exit of roomExits) {
      const [id] = exit.rooms;
      const room = rooms[id as number] as Room;
      const { x, y } = exit.position;
      expect(room.exits.map((i) => roomExits[i])).toContain(exit);
      expect(grid.get(x, y)).toBe(exit.door ? Tile.Door : Tile.Floor);
      expect(
        NEIGHBORS.some((n) => contains(room, { x: x + n.x, y: y + n.y })),
      ).toBe(true);
      expect(contains(room, exit.position)).toBe(false);
    }
  });

  it('counts the doors of a room', () => {
    // given
    const options = { doorChance: 0.5 };

    // when
    const { rooms, roomExits } = maze(options);

    // then
    for (const room of rooms) {
      const doors = room.exits.filter((i) => roomExits[i]?.door).length;
      expect(room.doorCount).toBe(doors);
    }
  });

  it('puts a door in every opening when doorChance is 1', () => {
    // given
    const options = { doorChance: 1 };

    // when
    const { roomExits } = maze(options);

    // then
    expect(roomExits.every(({ door }) => door)).toBe(true);
  });

  it('leaves plain gaps when doorChance is 0', () => {
    // given
    const options = { doorChance: 0 };

    // when
    const { grid, roomExits } = maze(options);

    // then
    expect(roomExits.some(({ door }) => door)).toBe(false);
    for (const { position } of roomExits) {
      expect(grid.get(position.x, position.y)).toBe(Tile.Floor);
    }
  });

  it('draws the number of openings from exitsPerRoom', () => {
    // given
    const exitsPerRoom = { min: 2, max: 2 };
    const rooms = { count: { min: 1, max: 1 } };

    // when
    const results = SEEDS.map((seed) => maze({ exitsPerRoom, rooms }, seed));

    // then
    for (const { rooms: placed } of results) {
      expect(placed.map(({ exitCount }) => exitCount)).toEqual([2]);
    }
  });

  it('connects the maze and all rooms', () => {
    // given
    const rooms = { count: { min: 6, max: 6 } };

    // when
    const results = SEEDS.map((seed) => maze({ rooms }, seed));

    // then
    for (const result of results) {
      expect(reachable(result, result.start)).toBe(passable(result));
    }
  });

  it('adds openings to join stretches of maze that a room cuts off', () => {
    // given
    const exitsPerRoom = { min: 1, max: 1 };
    const rooms = {
      count: { min: 1, max: 1 },
      width: { min: 11, max: 11 },
      height: { min: 1, max: 1 },
    };

    // when
    const results = SEEDS.map((seed) =>
      generateMaze({
        width: 13,
        height: 7,
        random: mulberry32(seed),
        exitsPerRoom,
        rooms,
      }),
    );

    // then
    for (const result of results) {
      expect(reachable(result, result.start)).toBe(passable(result));
    }
    expect(results.some(({ roomExits }) => roomExits.length > 1)).toBe(true);
  });

  it('does not open rooms onto uncarved maze', () => {
    // given
    const fill = 0.05;

    // when
    const results = SEEDS.map((seed) => maze({ fill }, seed));

    // then
    for (const { grid, roomExits } of results) {
      for (const { position } of roomExits) {
        const floors = NEIGHBORS.filter(
          (n) => grid.get(position.x + n.x, position.y + n.y) === Tile.Floor,
        );
        expect(floors.length).toBeGreaterThanOrEqual(1);
      }
    }
  });

  it('is deterministic for a given source of randomness', () => {
    // given
    const seed = 7;

    // when
    const a = maze({}, seed);
    const b = maze({}, seed);

    // then
    expect(a.grid.toString()).toBe(b.grid.toString());
    expect(a.roomExits).toEqual(b.roomExits);
  });

  it('does not change the options', () => {
    // given
    const rooms = { count: { min: 2, max: 2 } };
    const options: MazeOptions = { width: 21, height: 21, rooms };
    const copy = structuredClone(options);

    // when
    generateMaze(options);

    // then
    expect(options).toEqual(copy);
  });

  it('refuses rooms together with a symmetry', () => {
    // given
    const symmetry = 'whirlpool';

    // when
    const act = () => maze({ symmetry });

    // then
    expect(act).toThrow(RangeError);
  });

  it.each([
    ['rooms.count', { count: { min: 3, max: 1 } }],
    ['rooms.width', { width: { min: 0, max: 3 } }],
    ['rooms.height', { height: { min: 1.5, max: 3 } }],
    ['rooms.sizeUniformity', { sizeUniformity: 2 }],
  ])('rejects invalid %s', (name, rooms) => {
    // given
    const options = { rooms };

    // when
    const act = () => maze(options);

    // then
    expect(act).toThrow(new RegExp(name.replace('.', '\\.')));
  });

  it('rejects an invalid doorChance', () => {
    // given
    const doorChance = 2;

    // when
    const act = () => maze({ doorChance });

    // then
    expect(act).toThrow(RangeError);
  });

  it('rejects an exitsPerRoom below 1', () => {
    // given
    const exitsPerRoom = { min: 0, max: 2 };

    // when
    const act = () => maze({ exitsPerRoom });

    // then
    expect(act).toThrow(RangeError);
  });
});
