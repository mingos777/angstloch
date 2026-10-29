import { describe, expect, it } from 'vitest';
import type { Point } from '../core/point';
import { Tile } from '../core/tile';
import { emptyMap } from '../pipeline/empty-map';
import { pipeline } from '../pipeline/pipeline';
import { Reserve } from '../pipeline/reserve';
import { createRoomShape } from '../rooms/create-room-shape';
import type { Room } from '../rooms/room';
import type { RoomTemplate } from '../rooms/templates/room-template';
import { TemplateCell } from '../rooms/templates/template-cell';
import { TemplatePlacementError } from '../rooms/templates/template-placement-error';
import { mulberry32 } from '../test-helpers/mulberry32';
import { placeMazeRooms } from './place-maze-rooms';
import type { PlaceMazeRoomsOptions } from './place-maze-rooms-options';

const { Floor: F, Wall: W, Exit: E, OptionalExit: O } = TemplateCell;

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

/** Runs the step alone on a wall map of 41 by 31. */
function place(options: PlaceMazeRoomsOptions = {}, seed = 1) {
  return pipeline(
    emptyMap({ width: 41, height: 31, tile: Tile.Wall }),
    [placeMazeRooms(options)],
    { random: mulberry32(seed) },
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

function apart(a: Room, b: Room, gap: number) {
  return (
    a.x >= b.x + b.width + gap ||
    b.x >= a.x + a.width + gap ||
    a.y >= b.y + b.height + gap ||
    b.y >= a.y + a.height + gap
  );
}

describe('placeMazeRooms', () => {
  it('marks every room as a room, templated rooms included', () => {
    // given
    const options = { roomCount: { min: 2, max: 2 }, templates: [closet] };

    // when
    const { rooms } = place(options);

    // then
    expect(rooms.some(({ template }) => template !== undefined)).toBe(true);
    expect(rooms.map(({ kind }) => kind)).toEqual(rooms.map(() => 'room'));
  });

  it('places the same rooms from the same seed', () => {
    // given
    const options = { roomCount: { min: 3, max: 3 }, templates: [closet] };

    // when
    const first = place(options, 5);
    const second = place(options, 5);

    // then
    expect(first.grid.toString()).toBe(second.grid.toString());
    expect(first.rooms).toEqual(second.rooms);
  });

  it('places one ordinary room by default', () => {
    // given
    const options = {};

    // when
    const { rooms } = place(options);

    // then
    expect(rooms).toHaveLength(1);
    expect(rooms[0]?.template).toBeUndefined();
  });

  it('draws the room count from the range', () => {
    // given
    const roomCount = { min: 1, max: 4 };

    // when
    const counts = SEEDS.map((seed) => place({ roomCount }, seed).rooms.length);

    // then
    expect(Math.min(...counts)).toBeGreaterThanOrEqual(1);
    expect(Math.max(...counts)).toBeLessThanOrEqual(4);
    expect(new Set(counts).size).toBeGreaterThan(1);
  });

  it('places no rooms when the count is 0', () => {
    // given
    const options = { roomCount: noRooms };

    // when
    const { rooms, roomShapes, grid } = place(options);

    // then
    expect(rooms).toEqual([]);
    expect(roomShapes).toEqual([]);
    expect(grid.toString()).not.toContain('.');
  });

  it('places no rooms when none fit the map', () => {
    // given
    const options = { roomWidth: { min: 99, max: 99 } };

    // when
    const { rooms } = place(options);

    // then
    expect(rooms).toEqual([]);
  });

  it('puts rooms on the lattice, with odd sizes', () => {
    // given
    const options = {
      roomCount: { min: 4, max: 4 },
      roomWidth: { min: 3, max: 8 },
      roomHeight: { min: 3, max: 8 },
    };

    // when
    const { rooms } = place(options);

    // then
    for (const room of rooms) {
      expect([room.x % 2, room.y % 2]).toEqual([1, 1]);
      expect([room.width % 2, room.height % 2]).toEqual([1, 1]);
    }
  });

  it('keeps room sizes within the ranges', () => {
    // given
    const options = {
      roomCount: { min: 3, max: 3 },
      roomWidth: { min: 5, max: 5 },
      roomHeight: { min: 3, max: 3 },
    };

    // when
    const { rooms } = place(options);

    // then
    expect(rooms.map(({ width, height }) => [width, height])).toEqual([
      [5, 3],
      [5, 3],
      [5, 3],
    ]);
  });

  it('puts templated rooms first and numbers the rooms in order', () => {
    // given
    const options = {
      templates: [{ ...closet, count: { min: 2, max: 2 } }, hall],
      roomCount: { min: 2, max: 2 },
    };

    // when
    const { rooms } = place(options);

    // then
    expect(rooms.map(({ template }) => template)).toEqual([
      0,
      0,
      1,
      undefined,
      undefined,
    ]);
    expect(rooms.map(({ id }) => id)).toEqual([0, 1, 2, 3, 4]);
  });

  it('turns the whole floor of every ordinary room into floor tiles', () => {
    // given
    const options = { roomCount: { min: 3, max: 3 } };

    // when
    const { grid, rooms } = place(options);

    // then
    for (const room of rooms) {
      for (let y = room.y; y < room.y + room.height; ++y) {
        for (let x = room.x; x < room.x + room.width; ++x) {
          expect(grid.get(x, y)).toBe(Tile.Floor);
        }
      }
    }
  });

  it('carves the floor of a template and leaves its walls and its exit closed', () => {
    // given
    const options = { templates: [closet], roomCount: noRooms };

    // when
    const { grid, rooms } = place(options);

    // then
    const [room] = rooms as [Room];
    expect([room.width, room.height]).toEqual([3, 3]);
    expect([room.x % 2, room.y % 2]).toEqual([0, 0]);
    expect(grid.get(room.x + 1, room.y + 1)).toBe(Tile.Floor);
    expect(grid.get(room.x, room.y + 1)).toBe(Tile.Wall);
    expect(grid.get(room.x + 1, room.y + 2)).toBe(Tile.Wall);
    expect(grid.get(room.x + 1, room.y)).toBe(Tile.Wall);
  });

  it('leaves at least three wall tiles between the floors of two rooms', () => {
    // given
    const options = { roomCount: { min: 8, max: 8 } };

    // when
    const results = SEEDS.map((seed) => place(options, seed).rooms);

    // then
    for (const rooms of results) {
      for (const a of rooms) {
        for (const b of rooms.filter(({ id }) => id > a.id)) {
          expect(apart(a, b, 3)).toBe(true);
        }
      }
    }
  });

  it('keeps ordinary rooms away from templated rooms', () => {
    // given
    const options = {
      templates: [{ ...hall, count: { min: 2, max: 2 } }],
      roomCount: { min: 4, max: 4 },
    };

    // when
    const results = SEEDS.map((seed) => place(options, seed).rooms);

    // then
    for (const [first, second, ...others] of results as [
      Room,
      Room,
      ...Room[],
    ][]) {
      for (const room of others) {
        expect(apart(room, first, 3)).toBe(true);
        expect(apart(room, second, 3)).toBe(true);
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
    const { rooms } = place({ templates, roomCount: noRooms });

    // then
    expect(rooms[0]).toMatchObject({ x: 10, y: 10 });
  });

  it('keeps ordinary rooms off the keepClear tile', () => {
    // given
    const keepClear = { x: 9, y: 9 };
    const options = { keepClear, roomCount: { min: 6, max: 6 } };

    // when
    const results = SEEDS.map((seed) => place(options, seed).rooms);

    // then
    for (const rooms of results) {
      expect(rooms.some((room) => contains(room, keepClear))).toBe(false);
    }
  });

  it('fails the attempt when a template covers the keepClear tile', () => {
    // given
    const templates = [
      {
        ...closet,
        positions: [{ coords: { x: 11, y: 11 }, anchor: 'center' as const }],
      },
    ];
    const options = { templates, keepClear: { x: 11, y: 11 } };

    // when
    const act = () => place(options);

    // then
    expect(act).toThrow(TemplatePlacementError);
    expect(act).toThrow('closet');
    expect(act).toThrow('keepClear (11, 11)');
  });

  it('throws a TemplatePlacementError for a template that does not fit', () => {
    // given
    const step = placeMazeRooms({ templates: [hall] });

    // when
    const act = () =>
      pipeline(emptyMap({ width: 7, height: 7, tile: Tile.Wall }), [step]);

    // then
    expect(act).toThrow(TemplatePlacementError);
  });

  it('gives every room a shape, an ordinary room a ring round its floor', () => {
    // given
    const options = { templates: [closet], roomCount: { min: 2, max: 2 } };

    // when
    const { rooms, roomShapes } = place(options);

    // then
    expect(roomShapes).toHaveLength(rooms.length);
    const [template, ...ordinary] = rooms as [Room, ...Room[]];
    expect(roomShapes[0]).toMatchObject({
      x: template.x,
      y: template.y,
      cells: closet.cells,
    });
    ordinary.forEach((room, index) => {
      expect(roomShapes[index + 1]).toEqual({
        ...createRoomShape(room),
        doors: [],
      });
    });
  });

  it('lists the door decision of a template exit in its shape', () => {
    // given
    const options = { templates: [closet], roomCount: noRooms, doorChance: 0 };

    // when
    const { rooms, roomShapes } = place(options);

    // then
    const [room] = rooms as [Room];
    expect(roomShapes[0]?.doors).toEqual([
      { x: room.x + 1, y: room.y, door: false },
    ]);
  });

  it('reserves the whole ring of an ordinary room as openable, its corners and floor as solid', () => {
    // given
    const options = {
      roomCount: { min: 1, max: 1 },
      roomWidth: { min: 5, max: 5 },
      roomHeight: { min: 3, max: 3 },
    };

    // when
    const { rooms, reserved, grid } = place(options);

    // then
    const [room] = rooms as [Room];
    const at = (x: number, y: number) => reserved[y * grid.width + x];
    const left = room.x - 1;
    const top = room.y - 1;
    const right = room.x + room.width;
    const bottom = room.y + room.height;
    for (let x = room.x; x < right; ++x) {
      expect(at(x, top)).toBe(Reserve.Openable);
      expect(at(x, bottom)).toBe(Reserve.Openable);
    }
    for (let y = room.y; y < bottom; ++y) {
      expect(at(left, y)).toBe(Reserve.Openable);
      expect(at(right, y)).toBe(Reserve.Openable);
    }
    for (const [x, y] of [
      [left, top],
      [right, top],
      [left, bottom],
      [right, bottom],
    ] as const) {
      expect(at(x, y)).toBe(Reserve.Solid);
    }
    expect(at(room.x + 2, room.y + 1)).toBe(Reserve.Solid);
  });

  it('reserves the exit of a template as openable and its walls as solid', () => {
    // given
    const options = { templates: [closet], roomCount: noRooms };

    // when
    const { rooms, reserved, grid } = place(options);

    // then
    const [room] = rooms as [Room];
    const at = (x: number, y: number) => reserved[y * grid.width + x];
    expect(at(room.x + 1, room.y)).toBe(Reserve.Openable);
    expect(at(room.x, room.y)).toBe(Reserve.Solid);
    expect(at(room.x + 1, room.y + 2)).toBe(Reserve.Solid);
    expect(at(room.x + 1, room.y + 1)).toBe(Reserve.Solid);
  });

  it('reserves nothing outside the rooms', () => {
    // given
    const options = { roomCount: { min: 3, max: 3 } };

    // when
    const { reserved, roomShapes } = place(options);

    // then
    const footprint = roomShapes.reduce(
      (sum, { width, height }) => sum + width * height,
      0,
    );
    expect(reserved.filter((value) => value !== Reserve.None)).toHaveLength(
      footprint,
    );
  });

  it('puts every room inside its area, on the lattice of the map', () => {
    // given
    const area = { width: { min: 15, max: 15 }, height: { min: 11, max: 11 } };
    const options = { area, roomCount: { min: 2, max: 2 } };

    // when
    const results = SEEDS.map((seed) => place(options, seed));

    // then
    for (const { roomShapes, rooms } of results) {
      const left = Math.min(...roomShapes.map(({ x }) => x));
      const top = Math.min(...roomShapes.map(({ y }) => y));
      const right = Math.max(...roomShapes.map(({ x, width }) => x + width));
      const bottom = Math.max(...roomShapes.map(({ y, height }) => y + height));
      expect(right - left).toBeLessThanOrEqual(15);
      expect(bottom - top).toBeLessThanOrEqual(11);
      for (const room of rooms) {
        expect([room.x % 2, room.y % 2]).toEqual([1, 1]);
      }
    }
  });

  it('appends its rooms to those of an earlier step, with ids that follow on', () => {
    // given
    const area = { width: { min: 15, max: 15 }, height: { min: 11, max: 11 } };
    const steps = [
      placeMazeRooms({ area, templates: [closet] }),
      placeMazeRooms({ area, roomCount: { min: 2, max: 2 } }),
    ] as const;

    // when
    const { rooms, roomShapes } = pipeline(
      emptyMap({ width: 41, height: 31, tile: Tile.Wall }),
      steps,
      { random: mulberry32(3) },
    );

    // then
    expect(rooms.map(({ id }) => id)).toEqual([0, 1, 2, 3]);
    expect(rooms.map(({ template }) => template)).toEqual([
      0,
      undefined,
      undefined,
      undefined,
    ]);
    expect(roomShapes).toHaveLength(4);
    const [a, b] = rooms as [Room, Room, ...Room[]];
    for (const later of rooms.slice(2)) {
      expect(apart(later, a, 1)).toBe(true);
      expect(apart(later, b, 1)).toBe(true);
    }
  });

  it('does not change the options it is given', () => {
    // given
    const options: PlaceMazeRoomsOptions = {
      roomCount: { min: 2, max: 2 },
      templates: [closet],
      keepClear: { x: 9, y: 9 },
      area: { width: { min: 21, max: 21 } },
    };
    const copy = structuredClone(options);

    // when
    place(options);

    // then
    expect(options).toEqual(copy);
  });

  it('throws a RangeError for a map that does not start as wall', () => {
    // given
    const step = placeMazeRooms();

    // when
    const act = () =>
      pipeline(emptyMap({ width: 41, height: 31, tile: Tile.Floor }), [step]);

    // then
    expect(act).toThrow(RangeError);
    expect(act).toThrow('placeMazeRooms');
  });

  it('throws a RangeError for an area larger than the map', () => {
    // given
    const step = placeMazeRooms({ area: { width: { min: 50, max: 50 } } });

    // when
    const act = () =>
      pipeline(emptyMap({ width: 41, height: 31, tile: Tile.Wall }), [step]);

    // then
    expect(act).toThrow(RangeError);
    expect(act).toThrow('area.width');
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
    const act = () => placeMazeRooms({ templates });

    // then
    expect(act).toThrow(RangeError);
    expect(act).toThrow('lattice');
  });

  it.each([
    ['roomCount', { roomCount: { min: 3, max: 1 } }],
    ['roomWidth', { roomWidth: { min: 0, max: 3 } }],
    ['roomHeight', { roomHeight: { min: 1.5, max: 3 } }],
    ['sizeUniformity', { sizeUniformity: 2 }],
    ['doorChance', { doorChance: -1 }],
    ['keepClear', { keepClear: { x: 1.5, y: 3 } }],
  ])('throws a RangeError for an invalid %s', (name, options) => {
    // given
    const invalid = options;

    // when
    const act = () => placeMazeRooms(invalid);

    // then
    expect(act).toThrow(RangeError);
    expect(act).toThrow(name);
  });
});
