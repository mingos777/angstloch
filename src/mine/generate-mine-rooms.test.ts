import { describe, expect, it } from 'vitest';
import type { Grid } from '../core/grid';
import { Tile } from '../core/tile';
import { TemplateCell } from '../rooms/templates/template-cell';
import type { RoomTemplate } from '../rooms/templates/room-template';
import { TemplatePlacementError } from '../rooms/templates/template-placement-error';
import { mulberry32 } from '../test-helpers/mulberry32';
import { generateMine } from './generate-mine';
import type { MineOptions } from './mine-options';

const { Floor: F, Wall: W, Exit: E, Door: D, OptionalExit: O } = TemplateCell;

const base: MineOptions = { width: 100, height: 60, density: 0.05 };

const closet: RoomTemplate = {
  cells: [
    [W, E, W],
    [W, F, W],
    [W, W, W],
  ],
  name: 'closet',
};

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

function floorTiles(grid: Grid): Set<number> {
  const tiles = new Set<number>();
  for (let y = 0; y < grid.height; ++y) {
    for (let x = 0; x < grid.width; ++x) {
      if (grid.get(x, y) === Tile.Floor) {
        tiles.add(y * grid.width + x);
      }
    }
  }
  return tiles;
}

describe('generateMine with ordinary rooms', () => {
  it('digs no rooms by default', () => {
    // given
    const options = { ...base, random: mulberry32(1) };

    // when
    const { rooms, roomExits } = generateMine(options);

    // then
    expect(rooms).toEqual([]);
    expect(roomExits).toEqual([]);
  });

  it('makes the same mine as before when there are no rooms', () => {
    // given
    const plain = generateMine({ ...base, random: mulberry32(1) });

    // when
    const none = generateMine({
      ...base,
      rooms: { count: { min: 0, max: 0 } },
      templates: [],
      random: mulberry32(1),
    });

    // then
    expect(none.grid.toString()).toBe(plain.grid.toString());
  });

  it('makes the same mine from the same seed', () => {
    // given
    const make = () =>
      generateMine({
        ...base,
        rooms: { count: { min: 3, max: 3 } },
        random: mulberry32(5),
      });

    // when
    const first = make();
    const second = make();

    // then
    expect(first.grid.toString()).toBe(second.grid.toString());
    expect(first.rooms).toEqual(second.rooms);
    expect(first.roomExits).toEqual(second.roomExits);
  });

  it('digs as many rooms as the range says, when there is room', () => {
    // given
    const options = {
      ...base,
      rooms: { count: { min: 3, max: 3 } },
      random: mulberry32(2),
    };

    // when
    const { rooms } = generateMine(options);

    // then
    expect(rooms).toHaveLength(3);
    expect(rooms.map((room) => room.id)).toEqual([0, 1, 2]);
  });

  it('digs one room when only the rooms option is given', () => {
    // given
    const options = { ...base, rooms: {}, random: mulberry32(2) };

    // when
    const { rooms } = generateMine(options);

    // then
    expect(rooms).toHaveLength(1);
  });

  it('digs fewer rooms when the map has no room for them', () => {
    // given
    const options = {
      width: 40,
      height: 40,
      density: 0.1,
      rooms: {
        count: { min: 8, max: 8 },
        width: { min: 15, max: 15 },
        height: { min: 15, max: 15 },
      },
      random: mulberry32(1),
    };

    // when
    const { rooms, grid } = generateMine(options);

    // then
    expect(rooms.length).toBeLessThan(8);
    expect(countPieces(grid)).toBe(1);
  });

  it('keeps the size of every room within the ranges', () => {
    // given
    const options = {
      ...base,
      rooms: {
        count: { min: 4, max: 4 },
        width: { min: 4, max: 6 },
        height: { min: 5, max: 8 },
      },
      random: mulberry32(3),
    };

    // when
    const { rooms } = generateMine(options);

    // then
    expect(rooms.length).toBeGreaterThan(0);
    for (const room of rooms) {
      expect(room.width).toBeGreaterThanOrEqual(4);
      expect(room.width).toBeLessThanOrEqual(6);
      expect(room.height).toBeGreaterThanOrEqual(5);
      expect(room.height).toBeLessThanOrEqual(8);
    }
  });

  it('gives every room the middle size at a size uniformity of 1', () => {
    // given
    const options = {
      ...base,
      rooms: {
        count: { min: 4, max: 4 },
        width: { min: 3, max: 9 },
        height: { min: 3, max: 9 },
        sizeUniformity: 1,
      },
      random: mulberry32(3),
    };

    // when
    const { rooms } = generateMine(options);

    // then
    expect(rooms.length).toBeGreaterThan(0);
    for (const room of rooms) {
      expect(room.width).toBe(6);
      expect(room.height).toBe(6);
    }
  });

  it('floors the whole of every room', () => {
    // given
    const options = {
      ...base,
      rooms: { count: { min: 4, max: 4 } },
      random: mulberry32(4),
    };

    // when
    const { rooms, grid } = generateMine(options);

    // then
    for (const room of rooms) {
      for (let y = room.y; y < room.y + room.height; ++y) {
        for (let x = room.x; x < room.x + room.width; ++x) {
          expect(grid.get(x, y)).toBe(Tile.Floor);
        }
      }
    }
  });

  it('walls every room in, except at its exits', () => {
    // given
    const options = {
      ...base,
      rooms: { count: { min: 4, max: 4 } },
      random: mulberry32(4),
    };

    // when
    const { rooms, roomExits, grid } = generateMine(options);

    // then
    const exits = new Set(
      roomExits.map(({ position }) => position.y * grid.width + position.x),
    );
    for (const room of rooms) {
      for (let y = room.y - 1; y <= room.y + room.height; ++y) {
        for (let x = room.x - 1; x <= room.x + room.width; ++x) {
          const inside =
            x >= room.x &&
            x < room.x + room.width &&
            y >= room.y &&
            y < room.y + room.height;
          if (!inside && !exits.has(y * grid.width + x)) {
            expect(grid.get(x, y)).toBe(Tile.Wall);
          }
        }
      }
    }
  });

  it('opens the number of exits that exits per room says', () => {
    // given
    const options = {
      ...base,
      rooms: { count: { min: 4, max: 4 } },
      exitsPerRoom: { min: 2, max: 2 },
      random: mulberry32(5),
    };

    // when
    const { rooms } = generateMine(options);

    // then
    expect(rooms.length).toBeGreaterThan(0);
    for (const room of rooms) {
      expect(room.exitCount).toBe(2);
      expect(room.exits).toHaveLength(2);
    }
  });

  it('opens at least one exit in every room', () => {
    // given
    const options = {
      ...base,
      rooms: { count: { min: 5, max: 5 } },
      random: mulberry32(6),
    };

    // when
    const { rooms } = generateMine(options);

    // then
    for (const room of rooms) {
      expect(room.exitCount).toBeGreaterThanOrEqual(1);
      expect(room.exitCount).toBeLessThanOrEqual(3);
    }
  });

  it('puts a door in every opening at a door chance of 1', () => {
    // given
    const options = {
      ...base,
      rooms: { count: { min: 4, max: 4 } },
      doorChance: 1,
      random: mulberry32(5),
    };

    // when
    const { roomExits, grid } = generateMine(options);

    // then
    expect(roomExits.length).toBeGreaterThan(0);
    for (const { position, door } of roomExits) {
      expect(door).toBe(true);
      expect(grid.get(position.x, position.y)).toBe(Tile.Door);
    }
  });

  it('puts a door in no opening at a door chance of 0', () => {
    // given
    const options = {
      ...base,
      rooms: { count: { min: 4, max: 4 } },
      doorChance: 0,
      random: mulberry32(5),
    };

    // when
    const { rooms, roomExits, grid } = generateMine(options);

    // then
    expect(roomExits.length).toBeGreaterThan(0);
    for (const { position, door } of roomExits) {
      expect(door).toBe(false);
      expect(grid.get(position.x, position.y)).toBe(Tile.Floor);
    }
    expect(rooms.every((room) => room.doorCount === 0)).toBe(true);
  });

  it('lists the exits of every room with their rooms and doors', () => {
    // given
    const options = {
      ...base,
      rooms: { count: { min: 4, max: 4 } },
      doorChance: 0.5,
      random: mulberry32(7),
    };

    // when
    const { rooms, roomExits } = generateMine(options);

    // then
    for (const room of rooms) {
      const own = room.exits.map((index) => roomExits[index]);
      expect(own.every((exit) => exit?.rooms[0] === room.id)).toBe(true);
      expect(own.filter((exit) => exit?.door).length).toBe(room.doorCount);
    }
    const listed = rooms.reduce((sum, room) => sum + room.exitCount, 0);
    expect(listed).toBe(roomExits.length);
  });

  it('never puts two openings of a room next to each other, diagonals included', () => {
    // given
    const layouts = ['fishbone', 'veins', 'pillars', 'rings'] as const;
    const seeds = Array.from({ length: 12 }, (_, i) => i + 1);

    // when
    const mines = layouts.flatMap((layout) =>
      seeds.map((seed) =>
        generateMine({
          width: 80,
          height: 50,
          layout,
          rooms: { count: { min: 2, max: 2 } },
          exitsPerRoom: { min: 6, max: 6 },
          random: mulberry32(seed),
        }),
      ),
    );

    // then
    let crowded = 0;
    let checked = 0;
    for (const { rooms, roomExits } of mines) {
      for (const room of rooms) {
        const spots = room.exits.map((index) => roomExits[index]?.position);
        for (const [i, a] of spots.entries()) {
          for (const b of spots.slice(i + 1)) {
            ++checked;
            if (
              Math.abs((a?.x ?? 0) - (b?.x ?? 0)) <= 1 &&
              Math.abs((a?.y ?? 0) - (b?.y ?? 0)) <= 1
            ) {
              ++crowded;
            }
          }
        }
      }
    }
    expect(checked).toBeGreaterThan(0);
    expect(crowded).toBe(0);
  });

  it('never puts two optional openings of a template next to each other', () => {
    // given
    const wall: RoomTemplate = {
      cells: [
        [W, E, O, O, O, O, O, W],
        [W, F, F, F, F, F, F, W],
        [W, F, F, F, F, F, F, W],
        [W, W, W, W, W, W, W, W],
      ],
    };
    const options = {
      ...base,
      templates: [wall],
      exitsPerRoom: { min: 5, max: 5 },
      random: mulberry32(1),
    };

    // when
    const { roomExits } = generateMine(options);

    // then
    expect(roomExits.length).toBeGreaterThan(1);
    for (const [i, a] of roomExits.entries()) {
      for (const b of roomExits.slice(i + 1)) {
        expect(
          Math.abs(a.position.x - b.position.x) <= 1 &&
            Math.abs(a.position.y - b.position.y) <= 1,
        ).toBe(false);
      }
    }
  });

  it('joins every room to the mine', () => {
    // given
    const seeds = [1, 2, 3, 4, 5, 6];

    // when
    const mines = seeds.map((seed) =>
      generateMine({
        ...base,
        rooms: { count: { min: 3, max: 6 } },
        doorChance: (seed % 3) / 2,
        minExits: seed % 3,
        random: mulberry32(seed),
      }),
    );

    // then
    for (const { grid } of mines) {
      expect(countPieces(grid)).toBe(1);
    }
  });

  it('joins every room to the mine, whatever the layout', () => {
    // given
    const layouts = ['fishbone', 'veins', 'pillars', 'rings'] as const;

    // when
    const mines = layouts.map((layout, i) =>
      generateMine({
        width: 80,
        height: 50,
        layout,
        rooms: { count: { min: 3, max: 4 } },
        caverns: { min: 1, max: 2 },
        random: mulberry32(i + 1),
      }),
    );

    // then
    for (const { grid } of mines) {
      expect(countPieces(grid)).toBe(1);
    }
  });

  it('only adds floor to the mine', () => {
    // given
    const plain = generateMine({ ...base, random: mulberry32(8) });

    // when
    const withRooms = generateMine({
      ...base,
      rooms: { count: { min: 4, max: 4 } },
      random: mulberry32(8),
    });

    // then
    const before = floorTiles(plain.grid);
    const after = floorTiles(withRooms.grid);
    expect(after.size).toBeGreaterThan(before.size);
    for (const tile of before) {
      expect(after.has(tile)).toBe(true);
    }
  });

  it('keeps the ring around the map as wall', () => {
    // given
    const options = {
      ...base,
      rooms: { count: { min: 8, max: 8 } },
      random: mulberry32(3),
    };

    // when
    const { grid } = generateMine(options);

    // then
    for (let x = 0; x < grid.width; ++x) {
      expect(grid.get(x, 0)).toBe(Tile.Wall);
      expect(grid.get(x, grid.height - 1)).toBe(Tile.Wall);
    }
    for (let y = 0; y < grid.height; ++y) {
      expect(grid.get(0, y)).toBe(Tile.Wall);
      expect(grid.get(grid.width - 1, y)).toBe(Tile.Wall);
    }
  });

  it('lists the tunnels that join the rooms after the others', () => {
    // given
    const options = {
      ...base,
      rooms: { count: { min: 3, max: 3 } },
      exitsPerRoom: { min: 1, max: 1 },
      random: mulberry32(2),
    };

    // when
    const { passages, rooms } = generateMine(options);

    // then
    const kinds = passages.map((passage) => passage.kind);
    const first = kinds.indexOf('tunnel');
    expect(first).toBeGreaterThan(0);
    expect(kinds.slice(first)).toHaveLength(rooms.length);
    expect(kinds.slice(first).every((kind) => kind === 'tunnel')).toBe(true);
  });

  it('digs rooms on a tiny map without failing', () => {
    // given
    const sizes = [
      [1, 1],
      [3, 3],
      [6, 6],
      [12, 12],
      [5, 30],
    ] as const;

    // when
    const mines = sizes.map(([width, height]) =>
      generateMine({
        width,
        height,
        rooms: { count: { min: 2, max: 2 } },
        random: mulberry32(1),
      }),
    );

    // then
    expect(mines).toHaveLength(sizes.length);
  });

  it.each([
    ['rooms.count', { rooms: { count: { min: 3, max: 2 } } }],
    ['rooms.width', { rooms: { width: { min: 0, max: 3 } } }],
    ['rooms.height', { rooms: { height: { min: 2.5, max: 3 } } }],
    ['rooms.sizeUniformity', { rooms: { sizeUniformity: 2 } }],
    ['exitsPerRoom', { exitsPerRoom: { min: 0, max: 2 } }],
    ['exitsPerRoom', { exitsPerRoom: { min: 3, max: 2 } }],
    ['doorChance', { doorChance: 1.5 }],
  ])('throws a RangeError for an invalid %s', (_name, invalid) => {
    // given
    const options = { ...base, ...invalid };

    // when
    const generate = () => generateMine(options);

    // then
    expect(generate).toThrow(RangeError);
  });
});

describe('generateMine with room templates', () => {
  it('places a template with its exit joined to the mine', () => {
    // given
    const options = {
      ...base,
      templates: [closet],
      random: mulberry32(1),
    };

    // when
    const { rooms, roomExits, grid } = generateMine(options);

    // then
    expect(rooms).toHaveLength(1);
    expect(rooms[0]?.template).toBe(0);
    expect(rooms[0]?.width).toBe(3);
    expect(rooms[0]?.height).toBe(3);
    expect(roomExits).toHaveLength(1);
    expect(countPieces(grid)).toBe(1);
  });

  it('puts the floor of a template where its design has it', () => {
    // given
    const options = {
      ...base,
      templates: [closet],
      random: mulberry32(1),
    };

    // when
    const { rooms, grid } = generateMine(options);

    // then
    const room = rooms[0];
    expect(grid.get((room?.x ?? 0) + 1, (room?.y ?? 0) + 1)).toBe(Tile.Floor);
    expect(grid.get(room?.x ?? 0, room?.y ?? 0)).toBe(Tile.Wall);
  });

  it('places as many copies as the template says', () => {
    // given
    const options = {
      ...base,
      templates: [{ ...closet, count: { min: 3, max: 3 } }],
      random: mulberry32(1),
    };

    // when
    const { rooms } = generateMine(options);

    // then
    expect(rooms).toHaveLength(3);
    expect(rooms.every((room) => room.template === 0)).toBe(true);
  });

  it('records the rotation and the mirroring of a template', () => {
    // given
    const options = {
      ...base,
      templates: [{ ...closet, rotate: [90 as const] }],
      random: mulberry32(1),
    };

    // when
    const { rooms } = generateMine(options);

    // then
    expect(rooms[0]?.rotation).toBe(90);
    expect(rooms[0]?.mirrored).toBe(false);
  });

  it('lists the templated rooms before the ordinary ones', () => {
    // given
    const options = {
      ...base,
      templates: [{ ...closet, count: { min: 2, max: 2 } }],
      rooms: { count: { min: 2, max: 2 } },
      random: mulberry32(2),
    };

    // when
    const { rooms } = generateMine(options);

    // then
    expect(rooms.map((room) => room.id)).toEqual([0, 1, 2, 3]);
    expect(rooms.map((room) => room.template)).toEqual([
      0,
      0,
      undefined,
      undefined,
    ]);
  });

  it('always makes a door of a door cell', () => {
    // given
    const doored: RoomTemplate = {
      cells: [
        [W, D, W],
        [W, F, W],
        [W, W, W],
      ],
    };
    const options = {
      ...base,
      templates: [doored],
      doorChance: 0,
      random: mulberry32(1),
    };

    // when
    const { roomExits, grid } = generateMine(options);

    // then
    expect(roomExits).toHaveLength(1);
    expect(roomExits[0]?.door).toBe(true);
    const at = roomExits[0]?.position;
    expect(grid.get(at?.x ?? 0, at?.y ?? 0)).toBe(Tile.Door);
  });

  it('opens an exit cell by the door chance', () => {
    // given
    const make = (doorChance: number) =>
      generateMine({
        ...base,
        templates: [closet],
        doorChance,
        random: mulberry32(1),
      }).roomExits[0]?.door;

    // when
    const always = make(1);
    const never = make(0);

    // then
    expect(always).toBe(true);
    expect(never).toBe(false);
  });

  it('opens optional exits as far as exits per room asks for', () => {
    // given
    const hall: RoomTemplate = {
      cells: [
        [W, W, E, W, W],
        [W, F, F, F, W],
        [O, F, F, F, O],
        [W, F, F, F, W],
        [W, W, O, W, W],
      ],
    };
    const options = {
      ...base,
      templates: [hall],
      exitsPerRoom: { min: 3, max: 3 },
      random: mulberry32(1),
    };

    // when
    const { rooms, grid } = generateMine(options);

    // then
    expect(rooms[0]?.exitCount).toBe(3);
    expect(countPieces(grid)).toBe(1);
  });

  it('opens only the fixed exits when exits per room asks for fewer', () => {
    // given
    const hall: RoomTemplate = {
      cells: [
        [W, W, E, W, W],
        [W, F, F, F, W],
        [E, F, F, F, O],
        [W, F, F, F, W],
        [W, W, O, W, W],
      ],
    };
    const options = {
      ...base,
      templates: [hall],
      exitsPerRoom: { min: 1, max: 1 },
      random: mulberry32(1),
    };

    // when
    const { rooms } = generateMine(options);

    // then
    expect(rooms[0]?.exitCount).toBe(2);
  });

  it('places a template inside one of its areas', () => {
    // given
    const area = { x: 60, y: 30, width: 30, height: 25 };
    const options = {
      ...base,
      templates: [{ ...closet, areas: [area] }],
      random: mulberry32(3),
    };

    // when
    const { rooms } = generateMine(options);

    // then
    const room = rooms[0];
    expect(room?.x).toBeGreaterThanOrEqual(60);
    expect(room?.y).toBeGreaterThanOrEqual(30);
    expect((room?.x ?? 0) + 3).toBeLessThanOrEqual(90);
    expect((room?.y ?? 0) + 3).toBeLessThanOrEqual(55);
  });

  it('places a template near its position', () => {
    // given
    const options = {
      ...base,
      templates: [
        {
          ...closet,
          positions: [{ coords: { x: 20, y: 40 }, anchor: 'center' as const }],
        },
      ],
      random: mulberry32(3),
    };

    // when
    const { rooms } = generateMine(options);

    // then
    const room = rooms[0];
    expect(Math.abs((room?.x ?? 0) + 1 - 20)).toBeLessThanOrEqual(6);
    expect(Math.abs((room?.y ?? 0) + 1 - 40)).toBeLessThanOrEqual(6);
  });

  it('throws a TemplatePlacementError for a template that does not fit', () => {
    // given
    const big: RoomTemplate = {
      cells: Array.from({ length: 70 }, (_, y) =>
        Array.from({ length: 70 }, (__, x) =>
          y === 0 && x === 35
            ? E
            : y === 0 || y === 69 || x === 0 || x === 69
              ? W
              : F,
        ),
      ),
      name: 'big',
    };
    const options = { ...base, templates: [big], random: mulberry32(1) };

    // when
    const generate = () => generateMine(options);

    // then
    expect(generate).toThrow(TemplatePlacementError);
  });

  it('throws a RangeError for a template that is not valid', () => {
    // given
    const noExit: RoomTemplate = {
      cells: [
        [W, W, W],
        [W, F, W],
        [W, W, W],
      ],
    };
    const options = { ...base, templates: [noExit], random: mulberry32(1) };

    // when
    const generate = () => generateMine(options);

    // then
    expect(generate).toThrow(RangeError);
  });

  it('joins templates and rooms to the mine, whatever the layout', () => {
    // given
    const layouts = ['fishbone', 'veins', 'pillars', 'rings'] as const;

    // when
    const mines = layouts.map((layout, i) =>
      generateMine({
        width: 80,
        height: 50,
        layout,
        templates: [
          { ...closet, count: { min: 1, max: 2 }, rotate: [0, 90, 180, 270] },
        ],
        rooms: { count: { min: 2, max: 3 } },
        minExits: 1,
        random: mulberry32(i + 1),
      }),
    );

    // then
    for (const { grid } of mines) {
      expect(countPieces(grid)).toBe(1);
    }
  });
});
