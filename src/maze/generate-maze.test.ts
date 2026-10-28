import { describe, expect, it, vi } from 'vitest';
import { generateMaze } from './generate-maze';
import { openExits } from '../exits/open-exits';
import { emptyMap } from '../pipeline/empty-map';
import { pipeline } from '../pipeline/pipeline';
import { digMaze } from './dig-maze';
import { openMazeRooms } from './open-maze-rooms';
import { placeMazeRooms } from './place-maze-rooms';
import type { Grid } from '../core/grid';
import type { MazeOptions } from './maze-options';
import type { MazeResult } from './maze-result';
import type { Point } from '../core/point';
import type { Room } from '../rooms/room';
import type { RoomTemplate } from '../rooms/templates/room-template';
import { TemplateCell } from '../rooms/templates/template-cell';
import { TemplatePlacementError } from '../rooms/templates/template-placement-error';
import { mulberry32 } from '../test-helpers/mulberry32';
import { Tile } from '../core/tile';

const { Floor: F, Wall: W, Exit: E, OptionalExit: O } = TemplateCell;

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
    width: 21,
    height: 21,
    random: mulberry32(seed),
    ...options,
  });
}

/** A maze with rooms, on a map big enough for a few. */
function withRooms(options: Partial<MazeOptions> = {}, seed = 1) {
  return maze({ width: 41, height: 31, ...options }, seed);
}

function positions(grid: Grid, predicate: (x: number, y: number) => boolean) {
  const result: Point[] = [];
  for (let y = 0; y < grid.height; ++y) {
    for (let x = 0; x < grid.width; ++x) {
      if (predicate(x, y)) {
        result.push({ x, y });
      }
    }
  }
  return result;
}

function floors(grid: Grid) {
  return positions(grid, (x, y) => grid.get(x, y) === Tile.Floor);
}

function cells(grid: Grid) {
  return floors(grid).filter(({ x, y }) => x % 2 === 1 && y % 2 === 1);
}

/** Counts the passable tiles reachable from the start. */
function reachable({ grid, start }: MazeResult) {
  const seen = new Set([`${String(start.x)},${String(start.y)}`]);
  const queue = [start];
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

function passable({ grid }: MazeResult) {
  return positions(grid, (x, y) => grid.get(x, y) !== Tile.Wall).length;
}

function contains(room: Room, { x, y }: Point) {
  return (
    x >= room.x &&
    x < room.x + room.width &&
    y >= room.y &&
    y < room.y + room.height
  );
}

describe('generateMaze', () => {
  it('produces a grid of the requested size', () => {
    // given
    const options = { width: 15, height: 9 };

    // when
    const { grid } = maze(options);

    // then
    expect([grid.width, grid.height]).toEqual([15, 9]);
  });

  it('makes a perfect maze of the whole map by default', () => {
    // given
    const options = { width: 21, height: 15 };

    // when
    const result = maze(options);

    // then
    expect(cells(result.grid)).toHaveLength(10 * 7);
    expect(floors(result.grid)).toHaveLength(2 * 10 * 7 - 1);
    expect(reachable(result)).toBe(floors(result.grid).length);
  });

  it('leaves the wall frame intact when there are no exits', () => {
    // given / when
    const { grid } = maze();
    const border = positions(
      grid,
      (x, y) => x === 0 || y === 0 || x === 20 || y === 20,
    );

    // then
    expect(border.every(({ x, y }) => grid.get(x, y) === Tile.Wall)).toBe(true);
  });

  it('starts near the center by default', () => {
    // given / when
    const { start, grid } = maze();

    // then
    expect(start).toEqual({ x: 11, y: 11 });
    expect(grid.get(11, 11)).toBe(Tile.Floor);
  });

  it('carves the maze with the options of maze', () => {
    // given
    const options = { maze: { start: { x: 3, y: 5 }, fill: 0 } };

    // when
    const { grid, start } = maze(options);

    // then
    expect(start).toEqual({ x: 3, y: 5 });
    expect(floors(grid)).toEqual([{ x: 3, y: 5 }]);
  });

  it.each([
    { x: 2, y: 3 },
    { x: 3, y: 4 },
    { x: 21, y: 3 },
    { x: -1, y: 3 },
    { x: 1.5, y: 3 },
  ])('rejects the start %o', (start) => {
    // given
    const generate = () => maze({ maze: { start } });

    // when / then
    expect(generate).toThrow(RangeError);
  });

  it.each([
    { width: 2, height: 9 },
    { width: 9, height: 2 },
    { width: 9.5, height: 9 },
  ])('rejects the dimensions %o', (dimensions) => {
    // given
    const generate = () => maze(dimensions);

    // when / then
    expect(generate).toThrow(RangeError);
  });

  it('adds no exits by default', () => {
    // given / when
    const { exits } = maze();

    // then
    expect(exits).toEqual([]);
  });

  it('adds the requested exits as doors on the border, facing maze cells', () => {
    // given
    const exits = { count: { min: 3, max: 3 }, lattice: true };

    // when
    const { grid, exits: doors } = maze({ exits });

    // then
    expect(doors).toHaveLength(3);
    for (const { x, y } of doors) {
      expect(grid.get(x, y)).toBe(Tile.Door);
      expect(x === 0 || y === 0 || x === 20 || y === 20).toBe(true);
      expect(x % 2 === 1 || y % 2 === 1).toBe(true);
    }
  });

  it('connects every exit to the maze, also on even-sized maps', () => {
    // given
    const options = {
      width: 20,
      height: 18,
      exits: { count: { min: 4, max: 4 } },
    };

    // when
    const result = maze(options);

    // then
    expect(result.exits).toHaveLength(4);
    expect(reachable(result)).toBe(passable(result));
  });

  it('tunnels from the border to a partially carved maze', () => {
    // given
    const options = {
      maze: { fill: 0, start: { x: 9, y: 9 } },
      exits: { count: { min: 1, max: 1 } },
    };

    // when
    const result = maze(options);

    // then
    expect(result.exits).toHaveLength(1);
    expect(reachable(result)).toBe(passable(result));
  });

  it('places no rooms unless asked to', () => {
    // given / when
    const { rooms, roomExits } = withRooms();

    // then
    expect(rooms).toEqual([]);
    expect(roomExits).toEqual([]);
  });

  it('places the rooms and templates, templated ones first', () => {
    // given
    const rooms = { roomCount: { min: 3, max: 3 }, templates: [closet] };

    // when
    const result = withRooms({ rooms });

    // then
    expect(result.rooms).toHaveLength(4);
    expect(result.rooms[0]?.template).toBe(0);
    expect(
      result.rooms.slice(1).every((room) => room.template === undefined),
    ).toBe(true);
  });

  it('opens every room and joins it to the maze', () => {
    // given
    const rooms = {
      roomCount: { min: 4, max: 4 },
      templates: [{ ...hall, count: { min: 2, max: 2 } }, closet],
    };

    // when
    const results = SEEDS.map((seed) => withRooms({ rooms }, seed));

    // then
    for (const result of results) {
      for (const room of result.rooms) {
        expect(room.exitCount).toBeGreaterThanOrEqual(1);
      }
      expect(reachable(result)).toBe(passable(result));
    }
  });

  it('joins the exits of templates to the maze even when little of it is carved', () => {
    // given
    const options = {
      rooms: {
        roomCount: { min: 0, max: 0 },
        templates: [{ ...closet, count: { min: 4, max: 4 } }],
      },
      maze: { fill: 0.05 },
    };

    // when
    const results = SEEDS.map((seed) => withRooms(options, seed));

    // then
    for (const result of results) {
      expect(result.roomExits).toHaveLength(4);
      expect(reachable(result)).toBe(passable(result));
    }
  });

  it('opens the rooms with the options of openings', () => {
    // given
    const options = {
      rooms: { roomCount: { min: 3, max: 3 } },
      openings: { doorChance: 0 },
    };

    // when
    const { grid, roomExits } = withRooms(options);

    // then
    expect(roomExits.length).toBeGreaterThan(0);
    for (const { position, door } of roomExits) {
      expect(door).toBe(false);
      expect(grid.get(position.x, position.y)).toBe(Tile.Floor);
    }
  });

  it('gives each step only its own options', () => {
    // given
    const carve = { start: { x: 9, y: 9 }, loopChance: 0.2 };
    const rooms = { roomCount: { min: 3, max: 3 } };
    const exits = { count: { min: 2, max: 2 } };
    const byHand = pipeline(
      emptyMap({ width: 41, height: 31, tile: Tile.Wall }),
      [
        placeMazeRooms(rooms),
        digMaze(carve),
        openMazeRooms(),
        openExits(exits),
      ],
      { random: mulberry32(5) },
    );

    // when
    const result = withRooms({ maze: carve, rooms, exits }, 5);

    // then
    expect(result.grid.toString()).toBe(byHand.grid.toString());
  });

  it('keeps rooms off the start of the maze given as keepClear', () => {
    // given
    const start = { x: 9, y: 9 };
    const rooms = { roomCount: { min: 6, max: 6 }, keepClear: start };

    // when
    const results = SEEDS.map((seed) =>
      withRooms({ maze: { start }, rooms }, seed),
    );

    // then
    for (const result of results) {
      expect(result.start).toEqual(start);
      expect(result.rooms.some((room) => contains(room, start))).toBe(false);
    }
  });

  it('starts outside the rooms when the middle is taken', () => {
    // given
    const rooms = {
      roomWidth: { min: 31, max: 31 },
      roomHeight: { min: 21, max: 21 },
    };

    // when
    const result = withRooms({ rooms });

    // then
    expect(result.rooms).toHaveLength(1);
    expect(result.rooms.some((room) => contains(room, result.start))).toBe(
      false,
    );
    expect(result.grid.get(result.start.x, result.start.y)).toBe(Tile.Floor);
  });

  it('starts outside a template that sits in the middle', () => {
    // given
    const rooms = {
      roomCount: { min: 0, max: 0 },
      templates: [
        {
          ...closet,
          positions: [{ coords: { x: 20, y: 15 }, anchor: 'center' as const }],
        },
      ],
    };

    // when
    const result = withRooms({ rooms });

    // then
    const [room] = result.rooms as [Room];
    expect(contains(room, result.start)).toBe(false);
    expect(result.grid.get(result.start.x, result.start.y)).toBe(Tile.Floor);
  });

  it('combines rooms with a pattern', () => {
    // given
    const options = {
      rooms: { roomCount: { min: 3, max: 3 } },
      maze: { pattern: 'whirlpool' as const },
    };

    // when
    const result = withRooms(options);

    // then
    expect(result.rooms).toHaveLength(3);
    expect(reachable(result)).toBe(passable(result));
  });

  it('builds the map once when nothing fails', () => {
    // given / when
    const { attempts, failures } = withRooms({ rooms: {} });

    // then
    expect(attempts).toBe(1);
    expect(failures).toEqual([]);
  });

  it('builds the map again when a template covers the start, and reports it', () => {
    // given: one of the two spots of the template covers the start
    const rooms = {
      roomCount: { min: 0, max: 0 },
      templates: [
        {
          ...closet,
          positions: [
            { coords: { x: 11, y: 11 }, anchor: 'center' as const },
            { coords: { x: 29, y: 19 }, anchor: 'center' as const },
          ],
        },
      ],
    };
    const start = { x: 11, y: 11 };
    const options = { rooms: { ...rooms, keepClear: start }, maze: { start } };

    // when
    const { attempts, failures, rooms: placed } = withRooms(options, 3);

    // then
    expect(attempts).toBe(2);
    expect(failures).toHaveLength(1);
    expect(failures[0]?.step).toBe('placeMazeRooms');
    expect(failures[0]?.error).toBeInstanceOf(TemplatePlacementError);
    expect(placed).toHaveLength(1);
  });

  it('throws a TemplatePlacementError for a template that always covers the start', () => {
    // given
    const rooms = {
      roomCount: { min: 0, max: 0 },
      templates: [
        {
          ...closet,
          positions: [{ coords: { x: 11, y: 11 }, anchor: 'center' as const }],
        },
      ],
    };
    const start = { x: 11, y: 11 };
    const options = { rooms: { ...rooms, keepClear: start }, maze: { start } };

    // when
    const act = () => withRooms(options);

    // then
    expect(act).toThrow(TemplatePlacementError);
  });

  it('throws a TemplatePlacementError for a template that does not fit', () => {
    // given
    const rooms = { templates: [hall] };

    // when
    const act = () => maze({ rooms, width: 7, height: 7 });

    // then
    expect(act).toThrow(TemplatePlacementError);
  });

  it.each([
    ['roomCount', { rooms: { roomCount: { min: 3, max: 1 } } }],
    ['loopChance', { maze: { loopChance: 2 } }],
    [
      'exitsPerRoom',
      { rooms: {}, openings: { exitsPerRoom: { min: 0, max: 2 } } },
    ],
    ['count', { exits: { count: { min: -1, max: 2 } } }],
  ])('rejects an invalid %s, named after its step', (name, options) => {
    // given
    const invalid = options as Partial<MazeOptions>;

    // when
    const act = () => maze(invalid);

    // then
    expect(act).toThrow(new RegExp(name));
  });

  it('produces the same maze for the same random sequence', () => {
    // given
    const options = {
      maze: { loopChance: 0.3, pattern: 'snowflake' as const },
      rooms: { roomCount: { min: 2, max: 3 } },
      exits: { count: { min: 2, max: 2 } },
    };

    // when
    const first = withRooms(options, 42);
    const second = withRooms(options, 42);

    // then
    expect(second.grid.toString()).toBe(first.grid.toString());
    expect(second.exits).toEqual(first.exits);
    expect(second.roomExits).toEqual(first.roomExits);
  });

  it('produces different mazes for different random sequences', () => {
    // given / when
    const first = maze({}, 1);
    const second = maze({}, 2);

    // then
    expect(second.grid.toString()).not.toBe(first.grid.toString());
  });

  it('does not change the options', () => {
    // given
    const options: MazeOptions = {
      width: 21,
      height: 21,
      maze: { start: { x: 5, y: 5 } },
      // clear of the start, which Math.random would otherwise put a room on now and then
      rooms: { roomCount: { min: 2, max: 2 }, keepClear: { x: 5, y: 5 } },
      openings: { exitsPerRoom: { min: 1, max: 2 } },
      exits: { count: { min: 1, max: 1 } },
    };
    const copy = structuredClone(options);

    // when
    generateMaze(options);

    // then
    expect(options).toEqual(copy);
  });

  it('draws randomness from the injected source only', () => {
    // given
    const spy = vi.spyOn(Math, 'random');
    const random = vi.fn(() => 0.5);

    // when
    generateMaze({ width: 9, height: 9, random });

    // then
    expect(random).toHaveBeenCalled();
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });

  it('falls back to Math.random when no source is injected', () => {
    // given
    const spy = vi.spyOn(Math, 'random').mockReturnValue(0);

    // when
    generateMaze({ width: 9, height: 9 });

    // then
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });
});
