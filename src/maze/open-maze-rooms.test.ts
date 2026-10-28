import { describe, expect, it } from 'vitest';
import type { Grid } from '../core/grid';
import type { Point } from '../core/point';
import { Tile } from '../core/tile';
import { emptyMap } from '../pipeline/empty-map';
import { pipeline } from '../pipeline/pipeline';
import { Reserve } from '../pipeline/reserve';
import { step } from '../pipeline/step';
import type { Exit } from '../rooms/exit';
import type { Room } from '../rooms/room';
import type { RoomTemplate } from '../rooms/templates/room-template';
import { TemplateCell } from '../rooms/templates/template-cell';
import { TemplatePlacementError } from '../rooms/templates/template-placement-error';
import { mulberry32 } from '../test-helpers/mulberry32';
import type { CarveMazeOptions } from './carve-maze-options';
import { carveMaze } from './carve-maze';
import { openMazeRooms } from './open-maze-rooms';
import type { OpenMazeRoomsOptions } from './open-maze-rooms-options';
import { placeMazeRooms } from './place-maze-rooms';
import type { PlaceMazeRoomsOptions } from './place-maze-rooms-options';

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

const noRooms = { min: 0, max: 0 };

interface Setup {
  rooms?: PlaceMazeRoomsOptions;
  maze?: CarveMazeOptions;
  open?: OpenMazeRoomsOptions;
  width?: number;
  height?: number;
  seed?: number;
}

/** Places the rooms, carves the maze and opens the rooms, on a wall map of 31 by 21 unless asked otherwise. */
function open({
  rooms = { roomCount: { min: 3, max: 3 } },
  maze = {},
  open: options = {},
  width = 31,
  height = 21,
  seed = 1,
}: Setup = {}) {
  return pipeline(
    emptyMap({ width, height, tile: Tile.Wall }),
    [placeMazeRooms(rooms), carveMaze(maze), openMazeRooms(options)],
    { random: mulberry32(seed), attempts: 1 },
  );
}

function contains(room: Room, { x, y }: Point) {
  return (
    x >= room.x &&
    x < room.x + room.width &&
    y >= room.y &&
    y < room.y + room.height
  );
}

/** Whether every tile that is not wall can be reached from every other. */
function isConnected(grid: Grid): boolean {
  const open: Point[] = [];
  for (let y = 0; y < grid.height; ++y) {
    for (let x = 0; x < grid.width; ++x) {
      if (grid.get(x, y) !== Tile.Wall) {
        open.push({ x, y });
      }
    }
  }
  const [from] = open;
  if (!from) {
    return true;
  }
  const seen = new Set([from.y * grid.width + from.x]);
  const queue = [from];
  for (let point = queue.shift(); point; point = queue.shift()) {
    for (const n of NEIGHBORS) {
      const next = { x: point.x + n.x, y: point.y + n.y };
      const key = next.y * grid.width + next.x;
      if (grid.get(next.x, next.y) !== Tile.Wall && !seen.has(key)) {
        seen.add(key);
        queue.push(next);
      }
    }
  }
  return seen.size === open.length;
}

describe('openMazeRooms', () => {
  it('opens every room onto the maze', () => {
    // given
    const rooms = { roomCount: { min: 4, max: 4 } };

    // when
    const results = SEEDS.map((seed) => open({ rooms, seed }));

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
    const { grid, rooms, roomExits } = open(options);

    // then
    expect(roomExits.length).toBeGreaterThan(0);
    for (const exit of roomExits) {
      const room = rooms[exit.rooms[0] ?? -1] as Room;
      const { x, y } = exit.position;
      expect(room.exits.map((i) => roomExits[i])).toContain(exit);
      expect(grid.get(x, y)).toBe(exit.door ? Tile.Door : Tile.Floor);
      expect(
        NEIGHBORS.some((n) => contains(room, { x: x + n.x, y: y + n.y })),
      ).toBe(true);
      expect(contains(room, exit.position)).toBe(false);
    }
  });

  it('connects the maze and all rooms', () => {
    // given
    const rooms = { roomCount: { min: 5, max: 5 } };

    // when
    const results = SEEDS.map((seed) => open({ rooms, seed }));

    // then
    for (const { grid } of results) {
      expect(isConnected(grid)).toBe(true);
    }
  });

  it('draws the number of openings from exitsPerRoom', () => {
    // given
    const exitsPerRoom = { min: 2, max: 2 };
    const rooms = { roomCount: { min: 1, max: 1 } };

    // when
    const results = SEEDS.map((seed) =>
      open({ rooms, open: { exitsPerRoom }, seed }),
    );

    // then
    for (const result of results) {
      expect(result.rooms.map(({ exitCount }) => exitCount)).toEqual([2]);
    }
  });

  it('adds openings to join stretches of maze that a room cuts off', () => {
    // given
    const rooms = {
      roomWidth: { min: 11, max: 11 },
      roomHeight: { min: 1, max: 1 },
    };
    const exitsPerRoom = { min: 1, max: 1 };

    // when
    const results = SEEDS.map((seed) =>
      open({ rooms, open: { exitsPerRoom }, width: 13, height: 7, seed }),
    );

    // then
    for (const { grid } of results) {
      expect(isConnected(grid)).toBe(true);
    }
    expect(results.some(({ roomExits }) => roomExits.length > 1)).toBe(true);
  });

  it('does not open rooms onto uncarved maze', () => {
    // given
    const maze = { fill: 0.05 };

    // when
    const results = SEEDS.map((seed) => open({ maze, seed }));

    // then
    for (const { grid, roomExits } of results) {
      for (const { position } of roomExits) {
        const floors = NEIGHBORS.filter(
          (n) => grid.get(position.x + n.x, position.y + n.y) === Tile.Floor,
        );
        expect(floors.length).toBeGreaterThanOrEqual(2);
      }
    }
  });

  it('puts a door in every opening when doorChance is 1', () => {
    // given
    const doorChance = 1;

    // when
    const { roomExits } = open({ open: { doorChance } });

    // then
    expect(roomExits.every(({ door }) => door)).toBe(true);
  });

  it('leaves plain gaps when doorChance is 0', () => {
    // given
    const doorChance = 0;

    // when
    const { grid, roomExits } = open({ open: { doorChance } });

    // then
    expect(roomExits.some(({ door }) => door)).toBe(false);
    for (const { position } of roomExits) {
      expect(grid.get(position.x, position.y)).toBe(Tile.Floor);
    }
  });

  it('counts the doors of a room', () => {
    // given
    const doorChance = 0.5;

    // when
    const { rooms, roomExits } = open({ open: { doorChance } });

    // then
    for (const room of rooms) {
      const doors = room.exits.filter((i) => roomExits[i]?.door).length;
      expect(room.doorCount).toBe(doors);
    }
  });

  it('opens the fixed exit of a template onto the maze', () => {
    // given
    const rooms = { roomCount: noRooms, templates: [closet] };

    // when
    const results = SEEDS.map((seed) => open({ rooms, seed }));

    // then
    for (const { grid, rooms: placed, roomExits } of results) {
      const [room] = placed as [Room];
      expect(roomExits).toHaveLength(1);
      expect(roomExits[0]?.position).toEqual({ x: room.x + 1, y: room.y });
      expect(grid.get(room.x + 1, room.y)).toBe(Tile.Door);
      expect(grid.get(room.x + 1, room.y - 1)).toBe(Tile.Floor);
    }
  });

  it('keeps the door decision of a template', () => {
    // given
    const withDoor = {
      ...closet,
      cells: [[W, D, W], ...closet.cells.slice(1)],
    };
    const rooms = { roomCount: noRooms, templates: [withDoor] };

    // when
    const { roomExits } = open({ rooms, open: { doorChance: 0 } });

    // then
    expect(roomExits[0]?.door).toBe(true);
  });

  it('opens optional exits of a template as far as exitsPerRoom asks', () => {
    // given
    const rooms = { roomCount: noRooms, templates: [hall] };
    const exitsPerRoom = { min: 3, max: 3 };

    // when
    const results = SEEDS.map((seed) =>
      open({ rooms, open: { exitsPerRoom }, seed }),
    );

    // then
    for (const result of results) {
      expect(result.rooms[0]?.exitCount).toBe(3);
    }
  });

  it('joins the fixed exits to the maze even when little of it is carved', () => {
    // given
    const rooms = {
      roomCount: noRooms,
      templates: [{ ...closet, count: { min: 4, max: 4 } }],
    };
    const maze = { fill: 0.05 };

    // when
    const results = SEEDS.map((seed) => open({ rooms, maze, seed }));

    // then
    for (const result of results) {
      expect(result.roomExits).toHaveLength(4);
      expect(isConnected(result.grid)).toBe(true);
    }
  });

  it('fails the attempt when a fixed exit cannot be joined to the maze', () => {
    // given: the template cuts the map in two, and only one half is carved
    const wall = [W, W, W, W, W, E, W, W, W, W, W];
    const divider: RoomTemplate = {
      name: 'divider',
      cells: [wall, [W, F, F, F, F, F, F, F, F, F, W], wall],
      positions: [{ coords: { x: 5, y: 3 }, anchor: 'center' }],
    };
    const rooms = { roomCount: noRooms, templates: [divider] };

    // when
    const act = () => open({ rooms, maze: { fill: 0 }, width: 11, height: 7 });

    // then
    expect(act).toThrow(TemplatePlacementError);
  });

  it('reserves every opening as solid, with no openable tile beside it', () => {
    // given
    const rooms = { roomCount: { min: 4, max: 4 } };

    // when
    const { grid, reserved, roomExits } = open({ rooms });

    // then
    for (const { position } of roomExits) {
      expect(reserved[position.y * grid.width + position.x]).toBe(
        Reserve.Solid,
      );
      for (let dy = -1; dy <= 1; ++dy) {
        for (let dx = -1; dx <= 1; ++dx) {
          const at = (position.y + dy) * grid.width + position.x + dx;
          expect(reserved[at]).not.toBe(Reserve.Openable);
        }
      }
    }
  });

  it('leaves rooms that have exits already alone', () => {
    // given
    const once = open();

    // when
    const twice = pipeline(
      emptyMap({ width: 31, height: 21, tile: Tile.Wall }),
      [
        placeMazeRooms({ roomCount: { min: 3, max: 3 } }),
        carveMaze(),
        openMazeRooms(),
        openMazeRooms(),
      ],
      { random: mulberry32(1), attempts: 1 },
    );

    // then
    expect(twice.grid.toString()).toBe(once.grid.toString());
    expect(twice.rooms).toEqual(once.rooms);
    expect(twice.roomExits).toEqual(once.roomExits);
  });

  it('appends its exits to the ones there are', () => {
    // given
    const earlier: Exit = { position: { x: 0, y: 0 }, rooms: [], door: false };
    const exits = step<object, { roomExits: Exit[] }>(
      'earlierExits',
      { adds: ['roomExits'] },
      () => ({ roomExits: [earlier] }),
    );

    // when
    const result = pipeline(
      emptyMap({ width: 31, height: 21, tile: Tile.Wall }),
      [placeMazeRooms(), carveMaze(), exits, openMazeRooms()],
      { random: mulberry32(1), attempts: 1 },
    );

    // then
    const [room] = result.rooms as [Room];
    expect(result.roomExits[0]).toBe(earlier);
    expect(room.exits[0]).toBe(1);
    expect(result.roomExits[1]?.rooms).toEqual([0]);
  });

  it('does not change the rooms of the steps before it', () => {
    // given
    let placed: Room[] = [];
    const keep = step<{ rooms: Room[] }>('keep', { needs: ['rooms'] }, (s) => {
      placed = s.rooms;
      return {};
    });

    // when
    pipeline(
      emptyMap({ width: 31, height: 21, tile: Tile.Wall }),
      [placeMazeRooms(), keep, carveMaze(), openMazeRooms()],
      { random: mulberry32(1), attempts: 1 },
    );

    // then
    expect(placed.map(({ exitCount }) => exitCount)).toEqual([0]);
    expect(placed[0]?.exits).toEqual([]);
  });

  it('needs rooms and their shapes', () => {
    // given
    const map = emptyMap({ width: 31, height: 21, tile: Tile.Wall });

    // when
    const act = () => pipeline(map, [carveMaze(), openMazeRooms() as never]);

    // then
    expect(act).toThrow(/rooms/);
  });

  it.each([
    ['exitsPerRoom', { exitsPerRoom: { min: 0, max: 2 } }],
    ['doorChance', { doorChance: 2 }],
  ])('rejects an invalid %s', (name, options: OpenMazeRoomsOptions) => {
    // given
    const invalid = options;

    // when
    const act = () => openMazeRooms(invalid);

    // then
    expect(act).toThrow(new RegExp(name));
  });
});
