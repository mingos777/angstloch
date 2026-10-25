import { describe, expect, it } from 'vitest';
import { generateMaze } from './generate-maze';
import type { MazeOptions } from './maze-options';
import type { MazeResult } from './maze-result';
import type { Point } from './point';
import type { Room } from './room';
import type { RoomTemplate } from './room-template';
import { TemplateCell } from './template-cell';
import { TemplatePlacementError } from './template-placement-error';
import { mulberry32 } from './test-helpers/mulberry32';
import { Tile } from './tile';

const { Floor: F, Wall: W, Exit: E, Door: D, OptionalExit: O } = TemplateCell;

const NEIGHBORS: readonly Point[] = [
  { x: 0, y: -1 },
  { x: 1, y: 0 },
  { x: 0, y: 1 },
  { x: -1, y: 0 },
];

const SEEDS = Array.from({ length: 20 }, (_, i) => i + 1);

/** Three by three: the exit is in the top wall and everything is on the lattice. */
const closet: RoomTemplate = {
  name: 'closet',
  cells: [
    [W, E, W],
    [W, F, W],
    [W, W, W],
  ],
};

/** A hall with a fixed exit and two optional ones. */
const hall: RoomTemplate = {
  name: 'hall',
  cells: [
    [W, W, W, W, W, W, W, W, W],
    [W, F, F, F, F, F, F, F, W],
    [W, F, F, F, F, F, F, F, W],
    [W, F, F, F, F, F, F, F, W],
    [W, W, W, E, W, O, W, O, W],
  ],
};

function maze(options: Partial<MazeOptions> = {}, seed = 1) {
  return generateMaze({
    width: 41,
    height: 31,
    random: mulberry32(seed),
    ...options,
  });
}

function inBox(room: Room, { x, y }: Point) {
  return (
    x >= room.x &&
    x < room.x + room.width &&
    y >= room.y &&
    y < room.y + room.height
  );
}

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

describe('generateMaze with templates', () => {
  it('puts templated rooms first and describes them', () => {
    // given
    const templates = [{ ...closet, count: { min: 2, max: 2 } }, hall];
    const rooms = { count: { min: 2, max: 2 } };

    // when
    const result = maze({ templates, rooms });

    // then
    expect(result.rooms.map(({ template }) => template)).toEqual([
      0,
      0,
      1,
      undefined,
      undefined,
    ]);
    expect(result.rooms.map(({ id }) => id)).toEqual([0, 1, 2, 3, 4]);
  });

  it('carves the floor of a template and leaves its walls', () => {
    // given
    const templates = [closet];

    // when
    const { grid, rooms } = maze({ templates });

    // then
    const [room] = rooms as [Room];
    expect([room.width, room.height]).toEqual([3, 3]);
    expect([room.x % 2, room.y % 2]).toEqual([0, 0]);
    expect(grid.get(room.x + 1, room.y + 1)).toBe(Tile.Floor);
    expect(grid.get(room.x, room.y + 1)).toBe(Tile.Wall);
    expect(grid.get(room.x + 2, room.y + 1)).toBe(Tile.Wall);
    expect(grid.get(room.x + 1, room.y + 2)).toBe(Tile.Wall);
  });

  it('opens the exit of a template onto the maze', () => {
    // given
    const templates = [closet];

    // when
    const results = SEEDS.map((seed) => maze({ templates }, seed));

    // then
    for (const { grid, rooms, roomExits } of results) {
      const [room] = rooms as [Room];
      expect(roomExits).toHaveLength(1);
      expect(roomExits[0]?.position).toEqual({ x: room.x + 1, y: room.y });
      expect(roomExits[0]?.rooms).toEqual([0]);
      expect(grid.get(room.x + 1, room.y)).toBe(Tile.Door);
      expect(grid.get(room.x + 1, room.y - 1)).toBe(Tile.Floor);
    }
  });

  it('turns an exit into a plain gap when doorChance is 0', () => {
    // given
    const templates = [closet];

    // when
    const { grid, rooms, roomExits } = maze({ templates, doorChance: 0 });

    // then
    const [room] = rooms as [Room];
    expect(grid.get(room.x + 1, room.y)).toBe(Tile.Floor);
    expect(roomExits[0]?.door).toBe(false);
  });

  it('always puts a door where a template has one', () => {
    // given
    const templates = [
      { ...closet, cells: [[W, D, W], ...closet.cells.slice(1)] },
    ];

    // when
    const { roomExits } = maze({ templates, doorChance: 0 });

    // then
    expect(roomExits[0]?.door).toBe(true);
  });

  it('opens optional exits as far as exitsPerRoom asks', () => {
    // given
    const templates = [hall];
    const exitsPerRoom = { min: 3, max: 3 };

    // when
    const results = SEEDS.map((seed) =>
      maze({ templates, exitsPerRoom }, seed),
    );

    // then
    for (const { rooms } of results) {
      expect(rooms[0]?.exitCount).toBe(3);
    }
  });

  it('opens only the fixed exit when exitsPerRoom asks for no more', () => {
    // given
    const templates = [hall];
    const exitsPerRoom = { min: 1, max: 1 };

    // when
    const results = SEEDS.map((seed) =>
      maze({ templates, exitsPerRoom }, seed),
    );

    // then
    for (const { rooms } of results) {
      expect(rooms[0]?.exitCount).toBe(1);
    }
  });

  it('never digs through the walls of a template', () => {
    // given
    const templates = [{ ...hall, count: { min: 2, max: 2 } }];
    const loopy = { loopChance: 1 };

    // when
    const results = SEEDS.map((seed) => maze({ templates, ...loopy }, seed));

    // then
    for (const { grid, rooms, roomExits } of results) {
      for (const room of rooms) {
        for (let y = room.y; y < room.y + room.height; ++y) {
          for (let x = room.x; x < room.x + room.width; ++x) {
            const edge =
              x === room.x ||
              y === room.y ||
              x === room.x + room.width - 1 ||
              y === room.y + room.height - 1;
            const opened = roomExits.some(
              ({ position }) => position.x === x && position.y === y,
            );
            if (edge && !opened) {
              expect(grid.get(x, y)).toBe(Tile.Wall);
            }
          }
        }
      }
    }
  });

  it('connects the maze and the templated rooms', () => {
    // given
    const templates = [{ ...hall, count: { min: 3, max: 3 } }, closet];

    // when
    const results = SEEDS.map((seed) => maze({ templates }, seed));

    // then
    for (const result of results) {
      expect(reachable(result, result.start)).toBe(passable(result));
    }
  });

  it('joins the exits to the maze even when little of it is carved', () => {
    // given
    const templates = [{ ...closet, count: { min: 4, max: 4 } }];
    const fill = 0.05;

    // when
    const results = SEEDS.map((seed) => maze({ templates, fill }, seed));

    // then
    for (const result of results) {
      expect(result.roomExits).toHaveLength(4);
      expect(reachable(result, result.start)).toBe(passable(result));
    }
  });

  it('keeps ordinary rooms away from templated rooms', () => {
    // given
    const templates = [{ ...hall, count: { min: 2, max: 2 } }];
    const rooms = { count: { min: 4, max: 4 } };

    // when
    const results = SEEDS.map((seed) => maze({ templates, rooms }, seed));

    // then
    for (const { rooms: placed } of results) {
      const [first, second, ...others] = placed as [Room, Room, ...Room[]];
      for (const room of others) {
        for (const template of [first, second]) {
          const apart =
            room.x >= template.x + template.width + 3 ||
            template.x >= room.x + room.width + 3 ||
            room.y >= template.y + template.height + 3 ||
            template.y >= room.y + room.height + 3;
          expect(apart).toBe(true);
        }
      }
    }
  });

  it('places templates at their positions', () => {
    // given
    const templates = [
      {
        ...closet,
        positions: [{ coords: { x: 11, y: 11 }, anchor: 'center' as const }],
      },
    ];

    // when
    const { rooms } = maze({ templates });

    // then
    expect(rooms[0]).toMatchObject({ x: 10, y: 10 });
  });

  it('starts outside a template that sits in the middle', () => {
    // given
    const templates = [
      {
        ...closet,
        positions: [{ coords: { x: 20, y: 15 }, anchor: 'center' as const }],
      },
    ];

    // when
    const result = maze({ templates });

    // then
    const [room] = result.rooms as [Room];
    expect(inBox(room, result.start)).toBe(false);
    expect(result.grid.get(result.start.x, result.start.y)).toBe(Tile.Floor);
  });

  it('refuses a start inside a templated room', () => {
    // given
    const templates = [
      {
        ...closet,
        positions: [{ coords: { x: 11, y: 11 }, anchor: 'center' as const }],
      },
    ];
    const start = { x: 11, y: 11 };

    // when
    const act = () => maze({ templates, start });

    // then
    expect(act).toThrow(RangeError);
  });

  it('throws a TemplatePlacementError for a template that does not fit', () => {
    // given
    const templates = [hall];

    // when
    const act = () => maze({ templates, width: 7, height: 7 });

    // then
    expect(act).toThrow(TemplatePlacementError);
  });

  it('rejects a template that does not fit the lattice', () => {
    // given
    const templates = [
      {
        ...closet,
        cells: [
          [W, E, W, W],
          ...closet.cells.slice(1).map((row) => [...row, W]),
        ],
      },
    ];

    // when
    const act = () => maze({ templates });

    // then
    expect(act).toThrow(RangeError);
  });

  it('throws when an exit cannot be joined to the carved maze', () => {
    // given: the template cuts the map in two, and only one half is carved
    const wall = [W, W, W, W, W, E, W, W, W, W, W];
    const templates: RoomTemplate[] = [
      {
        name: 'divider',
        cells: [wall, [W, F, F, F, F, F, F, F, F, F, W], wall],
        positions: [{ coords: { x: 5, y: 3 }, anchor: 'center' }],
      },
    ];

    // when
    const act = () => maze({ templates, width: 11, height: 7, fill: 0 });

    // then
    expect(act).toThrow(TemplatePlacementError);
  });

  it('refuses templates together with a symmetry', () => {
    // given
    const templates = [closet];

    // when
    const act = () => maze({ templates, symmetry: 'snowflake' });

    // then
    expect(act).toThrow(RangeError);
  });

  it('leaves the maze as it was without templates', () => {
    // given
    const templates: RoomTemplate[] = [];

    // when
    const a = maze({ templates }, 3);
    const b = maze({}, 3);

    // then
    expect(a.grid.toString()).toBe(b.grid.toString());
  });
});
