import { describe, expect, it } from 'vitest';
import type { Grid } from '../core/grid';
import { Tile } from '../core/tile';
import { emptyMap } from '../pipeline/empty-map';
import { pipeline } from '../pipeline/pipeline';
import { Reserve } from '../pipeline/reserve';
import { step } from '../pipeline/step';
import type { Exit } from '../rooms/exit';
import type { Room } from '../rooms/room';
import type { RoomShape } from '../rooms/room-shape';
import { TemplateCell } from '../rooms/templates/template-cell';
import type { RoomTemplate } from '../rooms/templates/room-template';
import { TemplatePlacementError } from '../rooms/templates/template-placement-error';
import { mulberry32 } from '../test-helpers/mulberry32';
import { digFishbone } from './dig-fishbone';
import type { MinePassage } from '../veins/mine-passage';
import { placeMineRooms } from './place-mine-rooms';

const { Floor: F, Wall: W, Exit: E } = TemplateCell;

const base = emptyMap({ width: 100, height: 60, tile: Tile.Wall });
const mine = digFishbone({ density: 0.05 });

const closet: RoomTemplate = {
  cells: [
    [W, E, W],
    [W, F, W],
    [W, W, W],
  ],
  name: 'closet',
};

/** A floor corridor along row 30, from column 10 to 89, made by hand. */
const corridor = step('corridor', {}, ({ grid }) => {
  for (let x = 10; x < 90; ++x) {
    grid.set(x, 30, Tile.Floor);
  }
  return {};
});

/** The number of pieces that the floor, doors included, falls into. */
function countPieces(grid: Grid): number {
  const seen = new Set<number>();
  let pieces = 0;
  for (let y = 0; y < grid.height; ++y) {
    for (let x = 0; x < grid.width; ++x) {
      if (grid.get(x, y) === Tile.Wall || seen.has(y * grid.width + x)) {
        continue;
      }
      ++pieces;
      const stack = [{ x, y }];
      for (let tile = stack.pop(); tile; tile = stack.pop()) {
        const key = tile.y * grid.width + tile.x;
        if (grid.get(tile.x, tile.y) === Tile.Wall || seen.has(key)) {
          continue;
        }
        seen.add(key);
        stack.push(
          { x: tile.x + 1, y: tile.y },
          { x: tile.x - 1, y: tile.y },
          { x: tile.x, y: tile.y + 1 },
          { x: tile.x, y: tile.y - 1 },
        );
      }
    }
  }
  return pieces;
}

describe('placeMineRooms', () => {
  it('marks every room as a room, templated rooms included', () => {
    // given
    const options = { roomCount: { min: 3, max: 3 }, templates: [closet] };

    // when
    const { rooms } = pipeline(base, [mine, placeMineRooms(options)], {
      random: mulberry32(5),
    });

    // then
    expect(rooms.some(({ template }) => template !== undefined)).toBe(true);
    expect(rooms.map(({ kind }) => kind)).toEqual(rooms.map(() => 'room'));
  });

  it('places the same rooms from the same seed', () => {
    // given
    const make = () =>
      pipeline(
        base,
        [mine, placeMineRooms({ roomCount: { min: 3, max: 3 } })],
        {
          random: mulberry32(5),
        },
      );

    // when
    const first = make();
    const second = make();

    // then
    expect(first.grid.toString()).toBe(second.grid.toString());
    expect(first.rooms).toEqual(second.rooms);
    expect(first.roomShapes).toEqual(second.roomShapes);
  });

  it('places rooms on a mine, joined to it in one piece', () => {
    // given
    const steps = [
      mine,
      placeMineRooms({ roomCount: { min: 3, max: 3 } }),
    ] as const;

    // when
    const { grid, rooms, passages } = pipeline(base, steps, {
      random: mulberry32(2),
    });

    // then
    expect(rooms.map(({ id }) => id)).toEqual([0, 1, 2]);
    expect(passages.filter(({ kind }) => kind === 'tunnel').length).toBe(
      rooms.reduce((sum, room) => sum + room.exitCount, 0),
    );
    expect(countPieces(grid)).toBe(1);
  });

  it('places rooms on floor that no mine step dug', () => {
    // given
    const steps = [
      corridor,
      placeMineRooms({ roomCount: { min: 4, max: 4 } }),
    ] as const;

    // when
    const { grid, rooms } = pipeline(base, steps, { random: mulberry32(3) });

    // then
    expect(rooms).toHaveLength(4);
    expect(countPieces(grid)).toBe(1);
  });

  it('gives every room a shape, a ring around the floor of an ordinary one', () => {
    // given
    const steps = [
      mine,
      placeMineRooms({ roomCount: { min: 3, max: 3 } }),
    ] as const;

    // when
    const { rooms, roomShapes } = pipeline(base, steps, {
      random: mulberry32(2),
    });

    // then
    expect(roomShapes).toHaveLength(rooms.length);
    rooms.forEach((room, id) => {
      const shape = roomShapes[id];
      expect(shape).toMatchObject({
        x: room.x - 1,
        y: room.y - 1,
        width: room.width + 2,
        height: room.height + 2,
        doors: [],
      });
      expect(shape?.cells[1]?.[0]).toBe(TemplateCell.OptionalExit);
      expect(shape?.cells[0]?.[0]).toBe(TemplateCell.Wall);
    });
  });

  it('records the door decisions of a template in its shape', () => {
    // given
    const steps = [
      mine,
      placeMineRooms({ roomCount: { min: 0, max: 0 }, templates: [closet] }),
    ] as const;

    // when
    const { rooms, roomShapes } = pipeline(base, steps, {
      random: mulberry32(4),
    });

    // then
    const [shape] = roomShapes;
    expect(rooms[0]?.template).toBe(0);
    expect(shape?.doors).toEqual([
      { x: (shape?.x ?? 0) + 1, y: shape?.y, door: true },
    ]);
  });

  it('reserves the walls and the floor of a room as solid', () => {
    // given
    const steps = [
      mine,
      placeMineRooms({ roomCount: { min: 3, max: 3 } }),
    ] as const;

    // when
    const { grid, rooms, reserved } = pipeline(base, steps, {
      random: mulberry32(2),
    });

    // then
    for (const room of rooms) {
      const corners = [
        { x: room.x - 1, y: room.y - 1 },
        { x: room.x + room.width, y: room.y + room.height },
      ];
      for (let y = room.y; y < room.y + room.height; ++y) {
        for (let x = room.x; x < room.x + room.width; ++x) {
          corners.push({ x, y });
        }
      }
      for (const { x, y } of corners) {
        expect(reserved[y * grid.width + x]).toBe(Reserve.Solid);
      }
    }
  });

  it('reserves the unopened ring of a room as openable', () => {
    // given
    const steps = [
      mine,
      placeMineRooms({
        roomCount: { min: 1, max: 1 },
        roomWidth: { min: 7, max: 7 },
        roomHeight: { min: 7, max: 7 },
        exitsPerRoom: { min: 1, max: 1 },
      }),
    ] as const;

    // when
    const { grid, rooms, roomExits, reserved } = pipeline(base, steps, {
      random: mulberry32(2),
    });

    // then
    const [room] = rooms;
    const [exit] = roomExits;
    const ring: { x: number; y: number }[] = [];
    for (let x = room?.x ?? 0; x < (room?.x ?? 0) + (room?.width ?? 0); ++x) {
      ring.push({ x, y: (room?.y ?? 0) - 1 });
      ring.push({ x, y: (room?.y ?? 0) + (room?.height ?? 0) });
    }
    const far = ring.filter(
      ({ x, y }) =>
        Math.abs(x - (exit?.position.x ?? 0)) > 1 ||
        Math.abs(y - (exit?.position.y ?? 0)) > 1,
    );
    expect(far.length).toBeGreaterThan(0);
    for (const { x, y } of far) {
      expect(reserved[y * grid.width + x]).toBe(Reserve.Openable);
    }
  });

  it('reserves an opened exit and the tiles around it as solid', () => {
    // given
    const steps = [
      mine,
      placeMineRooms({ roomCount: { min: 3, max: 3 } }),
    ] as const;

    // when
    const { grid, roomExits, reserved } = pipeline(base, steps, {
      random: mulberry32(2),
    });

    // then
    expect(roomExits.length).toBeGreaterThan(0);
    for (const { position } of roomExits) {
      for (let dy = -1; dy <= 1; ++dy) {
        for (let dx = -1; dx <= 1; ++dx) {
          const at = (position.y + dy) * grid.width + position.x + dx;
          expect(reserved[at]).not.toBe(Reserve.Openable);
        }
      }
      expect(reserved[position.y * grid.width + position.x]).toBe(
        Reserve.Solid,
      );
    }
  });

  it('builds nothing on a reserved tile', () => {
    // given
    const block = step('block', {}, ({ grid, reserved }) => {
      // the rock next to the corridor, on both sides, is reserved
      for (let y = 20; y < 41; ++y) {
        for (let x = 30; x < 70; ++x) {
          if (grid.get(x, y) === Tile.Wall) {
            reserved[y * grid.width + x] = Reserve.Solid;
          }
        }
      }
      return {};
    });
    const steps = [
      corridor,
      block,
      placeMineRooms({ roomCount: { min: 6, max: 6 } }),
    ] as const;

    // when
    const { grid } = pipeline(base, steps, { random: mulberry32(1) });

    // then
    for (let y = 20; y < 41; ++y) {
      for (let x = 30; x < 70; ++x) {
        expect(grid.get(x, y)).toBe(y === 30 ? Tile.Floor : Tile.Wall);
      }
    }
  });

  it('appends to the rooms of the steps before it', () => {
    // given
    const earlier = step<
      object,
      {
        passages: MinePassage[];
        rooms: Room[];
        roomExits: Exit[];
        roomShapes: RoomShape[];
      }
    >(
      'earlier',
      { adds: ['passages', 'rooms', 'roomExits', 'roomShapes'] },
      () => ({
        passages: [{ kind: 'vein', tiles: [{ x: 0, y: 0 }], width: 1 }],
        rooms: [
          {
            id: 0,
            kind: 'room',
            x: 0,
            y: 0,
            width: 1,
            height: 1,
            exits: [0],
            exitCount: 1,
            doorCount: 0,
          },
        ],
        roomExits: [{ position: { x: 0, y: 0 }, rooms: [0], door: false }],
        roomShapes: [
          {
            x: 0,
            y: 0,
            width: 1,
            height: 1,
            cells: [[F]],
            exits: [],
            rotation: 0,
            mirrored: false,
            doors: [],
          },
        ],
      }),
    );
    const steps = [
      mine,
      earlier,
      placeMineRooms({ roomCount: { min: 2, max: 2 } }),
    ] as const;

    // when
    const { rooms, roomExits, roomShapes, passages } = pipeline(base, steps, {
      random: mulberry32(2),
    });

    // then
    expect(rooms.map(({ id }) => id)).toEqual([0, 1, 2]);
    expect(rooms[1]?.exits[0]).toBe(1);
    expect(roomExits[1]?.rooms).toEqual([1]);
    expect(roomShapes).toHaveLength(3);
    expect(passages[0]?.kind).toBe('vein');
  });

  it('retries a map where a template cannot be joined', () => {
    // given
    let calls = 0;
    // the first map has no floor to join the closet to, the second has
    const late = step('late', {}, ({ grid }) => {
      if (++calls > 1) {
        for (let x = 10; x < 90; ++x) {
          grid.set(x, 30, Tile.Floor);
        }
      }
      return {};
    });
    const steps = [
      late,
      placeMineRooms({ roomCount: { min: 0, max: 0 }, templates: [closet] }),
    ] as const;

    // when
    const { attempts, failures, rooms } = pipeline(base, steps, {
      random: mulberry32(1),
    });

    // then
    expect(attempts).toBe(2);
    expect(failures[0]?.error).toBeInstanceOf(TemplatePlacementError);
    expect(rooms).toHaveLength(1);
  });

  it('needs a map that starts as wall', () => {
    // given
    const grass = emptyMap({ width: 40, height: 30, tile: Tile.Grass });

    // when
    const run = () => pipeline(grass, [placeMineRooms()]);

    // then
    expect(run).toThrow(/starts as tile 3, not wall/);
  });

  it('throws a RangeError for a bad option at once', () => {
    // given
    const options = { roomWidth: { min: 0, max: 3 } };

    // when
    const make = () => placeMineRooms(options);

    // then
    expect(make).toThrow(RangeError);
  });

  it('throws a RangeError for a bad template at once', () => {
    // given
    const options = { templates: [{ cells: [] }] };

    // when
    const make = () => placeMineRooms(options);

    // then
    expect(make).toThrow(RangeError);
  });
});
