import { describe, expect, it } from 'vitest';
import { generateRoomDungeon } from './generate-room-dungeon';
import type { RoomDungeonOptions } from './room-dungeon-options';
import type { ScatterRoomsOptions } from './scatter-rooms-options';
import type { RoomTemplate } from '../rooms/templates/room-template';
import { TemplateCell } from '../rooms/templates/template-cell';
import { TemplatePlacementError } from '../rooms/templates/template-placement-error';
import { mulberry32 } from '../test-helpers/mulberry32';
import {
  NEIGHBORS,
  SEEDS,
  diagonalJumps,
  floorOf,
  reachable,
  touchingExits,
} from '../test-helpers/dungeon-checks';
import { Tile } from '../core/tile';

const {
  Unused: U,
  Floor: F,
  Wall: W,
  Exit: E,
  Door: D,
  OptionalExit: O,
} = TemplateCell;

/** Three by three: the exit is in the top wall and everything is on the lattice. */
const closet: RoomTemplate = {
  name: 'closet',
  cells: [
    [W, E, W],
    [W, F, W],
    [W, W, W],
  ],
};

/** A hall with a fixed exit and two optional ones, all on the lattice. */
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

/** The preset with these options for `scatter`, and any other options of the preset on top. */
function dungeon(
  scatter: ScatterRoomsOptions = {},
  seed = 1,
  options: Partial<RoomDungeonOptions> = {},
) {
  return generateRoomDungeon({
    width: 61,
    height: 31,
    random: mulberry32(seed),
    scatter,
    ...options,
  });
}

describe('generateRoomDungeon with templates', () => {
  it('puts templated rooms first and describes them', () => {
    // given
    const templates = [{ ...closet, count: { min: 2, max: 2 } }, hall];

    // when
    const { rooms } = dungeon({ templates });

    // then
    expect(rooms.slice(0, 3).map((room) => room.template)).toEqual([0, 0, 1]);
    expect(rooms.map((room) => room.id)).toEqual(rooms.map((_, i) => i));
  });

  it('describes the variant of a templated room', () => {
    // given
    const templates = [{ ...closet, rotate: [90 as const], mirror: false }];

    // when
    const [room] = dungeon({ templates }).rooms;

    // then
    expect([room?.rotation, room?.mirrored]).toEqual([90, false]);
  });

  it('leaves ordinary rooms without template fields', () => {
    // given
    const templates = [closet];

    // when
    const { rooms } = dungeon({ templates });

    // then
    expect(rooms.at(-1)?.template).toBeUndefined();
    expect(rooms.length).toBeGreaterThan(1);
  });

  it('carves floors and keeps walls', () => {
    // given
    const templates = [hall];

    // when
    const result = dungeon({ templates });

    // then
    const room = result.rooms[0];
    for (const [dy, row] of hall.cells.entries()) {
      for (const [dx, cell] of row.entries()) {
        const tile = result.grid.get((room?.x ?? 0) + dx, (room?.y ?? 0) + dy);
        if (cell === F) {
          expect(tile).toBe(Tile.Floor);
        } else if (cell === W) {
          expect(tile).toBe(Tile.Wall);
        }
      }
    }
  });

  it('places a template at its position', () => {
    // given
    const positions = [{ coords: { x: 30, y: 15 }, anchor: 'center' as const }];

    // when
    const [room] = dungeon({ templates: [{ ...hall, positions }] }).rooms;

    // then
    expect([room?.x, room?.y]).toEqual([26, 13]);
  });

  it('opens and connects the fixed exit of a template', () => {
    // given
    const templates = [closet];

    // when
    const result = dungeon({ templates });

    // then
    const room = result.rooms[0];
    expect(room?.exitCount).toBe(1);
    const [exit] = result.exits.filter(({ rooms }) => rooms.includes(0));
    expect(
      result.grid.get(exit?.position.x ?? 0, exit?.position.y ?? 0),
    ).not.toBe(Tile.Wall);
  });

  it.each(SEEDS)('joins every room to the template (seed %i)', (seed) => {
    // given
    const templates = [{ ...closet, count: { min: 3, max: 3 } }, hall];

    // when
    const result = dungeon({ templates }, seed);

    // then
    const seen = reachable(result, floorOf(result, 0));
    for (const room of result.rooms) {
      const { x, y } = floorOf(result, room.id);
      expect(seen.has(y * result.grid.width + x)).toBe(true);
    }
  });

  it.each(SEEDS)('connects every fixed exit (seed %i)', (seed) => {
    // given
    const templates = [{ ...closet, count: { min: 4, max: 4 } }, hall];

    // when
    const result = dungeon({ templates }, seed);

    // then
    const seen = reachable(result, floorOf(result, 0));
    const stubs = result.exits.filter(({ rooms }) => (rooms[0] ?? 99) < 5);
    expect(stubs.length).toBeGreaterThanOrEqual(5);
    for (const { position } of stubs) {
      expect(seen.has(position.y * result.grid.width + position.x)).toBe(true);
      const open = NEIGHBORS.filter(
        (n) =>
          result.grid.get(position.x + n.x, position.y + n.y) !== Tile.Wall,
      );
      expect(open.length).toBeGreaterThanOrEqual(2);
    }
  });

  it('gives a door cell a door whatever the door chance', () => {
    // given
    const door: RoomTemplate = {
      cells: [
        [W, W, W, W, W],
        [W, F, D, F, W],
        [W, W, W, W, W],
        [W, W, E, W, W],
      ],
    };

    // when
    const result = dungeon({ templates: [door], doorChance: 0 });

    // then
    const room = result.rooms[0];
    expect(result.grid.get((room?.x ?? 0) + 2, (room?.y ?? 0) + 1)).toBe(
      Tile.Door,
    );
  });

  it.each([
    [1, Tile.Door],
    [0, Tile.Floor],
  ])('follows the door chance of %i for an exit cell', (doorChance, tile) => {
    // given
    const templates = [closet];

    // when
    const result = dungeon({ templates, doorChance });

    // then
    const [exit] = result.exits.filter(({ rooms }) => rooms.includes(0));
    expect(result.grid.get(exit?.position.x ?? 0, exit?.position.y ?? 0)).toBe(
      tile,
    );
  });

  it('does not list an internal door as an exit', () => {
    // given
    const door: RoomTemplate = {
      cells: [
        [W, W, W, W, W],
        [W, F, D, F, W],
        [W, W, W, W, W],
        [W, W, E, W, W],
      ],
    };

    // when
    const result = dungeon({ templates: [door] });

    // then
    const room = result.rooms[0];
    const inside = { x: (room?.x ?? 0) + 2, y: (room?.y ?? 0) + 1 };
    expect(
      result.exits.some(
        ({ position }) => position.x === inside.x && position.y === inside.y,
      ),
    ).toBe(false);
  });

  it('opens an optional exit when the room needs a way out', () => {
    // given
    const optional: RoomTemplate = {
      cells: [
        [W, O, W],
        [W, F, W],
        [W, W, W],
      ],
    };

    // when
    const result = dungeon({ templates: [optional] });

    // then
    expect(result.rooms[0]?.exitCount).toBe(1);
  });

  it('opens no more optional exits than the room wants', () => {
    // given
    const exitsPerRoom = { min: 1, max: 1 };

    // when
    const result = dungeon({ templates: [hall] }, 1, {
      corridors: { exitsPerRoom },
    });

    // then
    expect(result.rooms[0]?.exitCount).toBe(1);
  });

  it('counts templated rooms towards the room count', () => {
    // given
    const templates = [{ ...closet, count: { min: 2, max: 2 } }];

    // when
    const { rooms } = dungeon({ templates, roomCount: { min: 5, max: 5 } });

    // then
    expect(rooms).toHaveLength(5);
  });

  it('counts templated floors towards the fill', () => {
    // given
    const templates = [hall];

    // when
    const { fill } = dungeon({
      templates,
      fill: 0.05,
      roomCount: { min: 0, max: 1 },
    });

    // then
    expect(fill).toBeCloseTo(22 / (61 * 31), 5);
  });

  it('keeps ordinary rooms away from templated rooms', () => {
    // given
    const templates = [hall];

    // when
    const result = dungeon({ templates, fill: 0.2 });

    // then
    const [room] = result.rooms;
    for (const other of result.rooms.slice(1)) {
      const apart =
        other.x >= (room?.x ?? 0) + 9 + 1 ||
        other.x + other.width + 1 <= (room?.x ?? 0) ||
        other.y >= (room?.y ?? 0) + 5 + 1 ||
        other.y + other.height + 1 <= (room?.y ?? 0);
      expect(apart).toBe(true);
    }
  });

  it.each(SEEDS)('never lets a diagonal step jump a wall (seed %i)', (seed) => {
    // given
    const templates = [{ ...closet, count: { min: 3, max: 3 } }, hall];

    // when
    const { grid } = dungeon({ templates, doorChance: 0.5 }, seed);

    // then
    expect(diagonalJumps(grid)).toEqual([]);
  });

  it.each(SEEDS)('keeps exits apart (seed %i)', (seed) => {
    // given
    const templates = [{ ...closet, count: { min: 3, max: 3 } }, hall];

    // when
    const result = dungeon({ templates }, seed);

    // then
    expect(touchingExits(result)).toEqual([]);
  });

  it('is deterministic', () => {
    // given
    const templates = [{ ...closet, count: { min: 2, max: 2 } }, hall];

    // when
    const first = dungeon({ templates }, 5);
    const second = dungeon({ templates }, 5);

    // then
    expect(first.grid.toString()).toBe(second.grid.toString());
  });

  it('works with a template and no other room', () => {
    // given
    const templates = [closet];

    // when
    const { rooms } = dungeon({ templates, roomCount: { min: 1, max: 1 } });

    // then
    expect(rooms).toHaveLength(1);
  });

  it('works with binary space partitioning', () => {
    // given
    const templates = [{ ...closet, count: { min: 2, max: 2 } }, hall];

    // when
    const result = dungeon({}, 1, {
      scatter: undefined,
      partition: { templates },
    });

    // then
    const seen = reachable(result, floorOf(result, 0));
    for (const room of result.rooms) {
      const { x, y } = floorOf(result, room.id);
      expect(seen.has(y * result.grid.width + x)).toBe(true);
    }
  });

  it('throws when a template does not fit', () => {
    // given
    const templates = [closet];

    // when
    const generate = () => dungeon({ templates }, 1, { width: 3, height: 3 });

    // then
    expect(generate).toThrow(TemplatePlacementError);
  });

  it('throws a RangeError for an invalid template', () => {
    // given
    const templates: RoomTemplate[] = [{ cells: [[F]] }];

    // when
    const generate = () => dungeon({ templates });

    // then
    expect(generate).toThrow(RangeError);
  });

  it('does not change dungeons without templates', () => {
    // given
    const options = { roomCount: { min: 4, max: 8 } };

    // when
    const plain = dungeon(options, 3);
    const empty = dungeon({ ...options, templates: [] }, 3);

    // then
    expect(empty.grid.toString()).toBe(plain.grid.toString());
  });
});

describe('generateRoomDungeon with templates on the lattice', () => {
  it.each(SEEDS)('keeps templated rooms on even corners (seed %i)', (seed) => {
    // given
    const templates = [{ ...closet, count: { min: 3, max: 3 } }, hall];

    // when
    const { rooms } = dungeon({ templates, placement: 'lattice' }, seed);

    // then
    for (const room of rooms.filter(({ template }) => template !== undefined)) {
      expect([room.x % 2, room.y % 2]).toEqual([0, 0]);
    }
  });

  it.each(SEEDS)('joins every room (seed %i)', (seed) => {
    // given
    const templates = [{ ...closet, count: { min: 3, max: 3 } }, hall];

    // when
    const result = dungeon({ templates, placement: 'lattice' }, seed);

    // then
    const seen = reachable(result, floorOf(result, 0));
    for (const room of result.rooms) {
      const { x, y } = floorOf(result, room.id);
      expect(seen.has(y * result.grid.width + x)).toBe(true);
    }
  });

  it('explains why a template cannot sit on the lattice', () => {
    // given
    const crooked: RoomTemplate = {
      name: 'crooked',
      cells: [
        [U, W, E, W, U],
        [W, W, F, W, W],
        [W, F, F, F, W],
        [W, W, F, W, W],
        [U, W, W, W, U],
      ],
    };

    // when
    const generate = () =>
      dungeon({ templates: [crooked], placement: 'lattice' });

    // then
    expect(generate).toThrow(RangeError);
    expect(generate).toThrow(/crooked.*lattice/);
  });
});

describe('generateRoomDungeon with template symmetry', () => {
  const left: RoomTemplate = {
    ...closet,
    positions: [{ coords: { x: 12, y: 12 }, anchor: 'center' }],
  };

  it('brings a mirror image along', () => {
    // given
    const options = {
      templates: [left],
      symmetry: 'horizontal' as const,
      templateSymmetry: true,
    };

    // when
    const { rooms } = dungeon(options);

    // then
    expect(rooms.filter(({ template }) => template === 0)).toHaveLength(2);
  });

  it('mirrors the tiles of the room', () => {
    // given
    const options = {
      templates: [
        {
          ...hall,
          positions: [{ coords: { x: 14, y: 10 }, anchor: 'center' as const }],
        },
      ],
      symmetry: 'horizontal' as const,
      templateSymmetry: true,
    };

    // when
    const result = dungeon(options);

    // then
    const [room, twin] = result.rooms;
    expect(twin?.template).toBe(0);
    for (let dy = 0; dy < (room?.height ?? 0); dy++) {
      for (let dx = 0; dx < (room?.width ?? 0); dx++) {
        const tile = result.grid.get((room?.x ?? 0) + dx, (room?.y ?? 0) + dy);
        const image = result.grid.get(
          (twin?.x ?? 0) + (room?.width ?? 0) - 1 - dx,
          (twin?.y ?? 0) + dy,
        );
        expect(image).toBe(tile);
      }
    }
  });

  it('flags a mirror image as mirrored', () => {
    // given
    const options = {
      templates: [left],
      symmetry: 'horizontal' as const,
      templateSymmetry: true,
    };

    // when
    const [room, twin] = dungeon(options).rooms;

    // then
    expect([room?.mirrored, twin?.mirrored]).toEqual([false, true]);
  });

  it('places one copy without the option', () => {
    // given
    const options = {
      templates: [left],
      symmetry: 'horizontal' as const,
    };

    // when
    const { rooms } = dungeon(options);

    // then
    expect(rooms.filter(({ template }) => template === 0)).toHaveLength(1);
  });

  it.each(SEEDS)('joins every room (seed %i)', (seed) => {
    // given
    const options = {
      templates: [{ ...closet, count: { min: 2, max: 2 } }, hall],
      symmetry: 'both' as const,
      templateSymmetry: true,
    };

    // when
    const result = dungeon(options, seed);

    // then
    const seen = reachable(result, floorOf(result, 0));
    for (const room of result.rooms) {
      const { x, y } = floorOf(result, room.id);
      expect(seen.has(y * result.grid.width + x)).toBe(true);
    }
  });
});

describe('generateRoomDungeon with template areas', () => {
  it.each(SEEDS)('keeps the template in its area (seed %i)', (seed) => {
    // given
    const areas = [
      { x: 0, y: 0, width: 12, height: 31 },
      { x: 49, y: 0, width: 12, height: 31 },
    ];
    const templates = [{ ...hall, areas }];

    // when
    const [room] = dungeon({ templates }, seed).rooms;

    // then
    const x = room?.x ?? 0;
    expect(x + 9 <= 12 || x >= 49).toBe(true);
  });

  it('rejects an area outside the map', () => {
    // given
    const areas = [{ x: 55, y: 0, width: 12, height: 10 }];

    // when
    const generate = () => dungeon({ templates: [{ ...hall, areas }] });

    // then
    expect(generate).toThrow(/outside/);
  });

  it('throws when the template does not fit in any area', () => {
    // given
    const areas = [{ x: 0, y: 0, width: 12, height: 6 }];
    const templates = [{ ...hall, areas, count: { min: 3, max: 3 } }];

    // when
    const generate = () => dungeon({ templates });

    // then
    expect(generate).toThrow(TemplatePlacementError);
  });
});

describe('generateRoomDungeon with templates that share walls', () => {
  const O = TemplateCell.OptionalExit;
  const west: RoomTemplate = {
    name: 'west',
    cells: [
      [W, O, W, W],
      [W, F, F, E],
      [W, W, W, W],
    ],
    positions: [{ coords: { x: 10, y: 10 }, anchor: 'top-left' }],
  };
  const east: RoomTemplate = {
    name: 'east',
    cells: [
      [W, W, O, W],
      [E, F, F, W],
      [W, W, W, W],
    ],
    positions: [{ coords: { x: 13, y: 10 }, anchor: 'top-left' }],
  };

  it('places rooms on a common wall', () => {
    // given
    const templates = [west, east];

    // when
    const { rooms } = dungeon({ templates });

    // then
    expect([rooms[0]?.x, rooms[1]?.x]).toEqual([10, 13]);
  });

  it('opens a single doorway between them', () => {
    // given
    const templates = [west, east];

    // when
    const { exits, grid } = dungeon({ templates });

    // then
    const shared = exits.filter(
      ({ rooms }) => rooms.length === 2 && rooms.includes(0),
    );
    expect(shared).toHaveLength(1);
    expect(shared[0]?.rooms).toEqual([0, 1]);
    expect(shared[0]?.position).toEqual({ x: 13, y: 11 });
    expect(grid.get(13, 11)).toBe(Tile.Door);
  });

  it('keeps the shared wall closed elsewhere', () => {
    // given
    const templates = [west, east];

    // when
    const { grid } = dungeon({ templates });

    // then
    expect([grid.get(13, 10), grid.get(13, 12)]).toEqual([
      Tile.Wall,
      Tile.Wall,
    ]);
  });

  it('gives the doorway no door at a door chance of 0', () => {
    // given
    const templates = [west, east];

    // when
    const { grid } = dungeon({ templates, doorChance: 0 });

    // then
    expect(grid.get(13, 11)).toBe(Tile.Floor);
  });

  it('counts the doorway as an exit of both rooms', () => {
    // given
    const templates = [west, east];

    // when
    const { rooms } = dungeon({ templates });

    // then
    expect(rooms[0]?.exits.some((i) => i === rooms[1]?.exits[0])).toBe(true);
  });

  it.each(SEEDS)('joins both rooms to the rest (seed %i)', (seed) => {
    // given
    const templates = [west, east];

    // when
    const result = dungeon({ templates }, seed);

    // then
    const seen = reachable(result, floorOf(result, 0));
    for (const room of result.rooms) {
      const { x, y } = floorOf(result, room.id);
      expect(seen.has(y * result.grid.width + x)).toBe(true);
    }
  });
});

describe('generateRoomDungeon with a double row of templates that share a corridor', () => {
  const at = (x: number, y: number, rotation: 0 | 180) => ({
    coords: { x, y },
    anchor: 'top-left' as const,
    rotations: [rotation],
  });
  const closet: RoomTemplate = {
    name: 'closet',
    cells: [
      [W, E, W, W, W],
      [W, F, F, F, W],
      [W, F, F, F, W],
      [W, F, F, F, W],
      [W, W, W, W, W],
    ],
    count: { min: 6, max: 6 },
    rotate: [0, 180],
    mirror: true,
    positions: [
      at(0, 30, 0),
      at(4, 30, 0),
      at(8, 30, 0),
      at(0, 24, 180),
      at(4, 24, 180),
      at(8, 24, 180),
    ],
  };

  it.each(SEEDS)('places all six and joins them (seed %i)', (seed) => {
    // given
    const templates = [closet];

    // when
    const result = dungeon({ templates }, seed, { height: 41 });

    // then
    expect(result.rooms.filter(({ template }) => template === 0)).toHaveLength(
      6,
    );
    const seen = reachable(result, floorOf(result, 0));
    for (const room of result.rooms) {
      const { x, y } = floorOf(result, room.id);
      expect(seen.has(y * result.grid.width + x)).toBe(true);
    }
  });

  it('opens a door of every closet onto the corridor between the rows', () => {
    // given
    const templates = [closet];

    // when
    const { grid, rooms, exits } = dungeon({ templates }, 1, { height: 41 });

    // then
    const doors = rooms
      .filter(({ template }) => template === 0)
      .flatMap((room) => room.exits.map((exit) => exits[exit]?.position));
    expect(doors).toHaveLength(6);
    expect(doors.every((door) => door?.y === 28 || door?.y === 30)).toBe(true);
    const xs = doors.map((door) => door?.x ?? 0);
    for (let x = Math.min(...xs); x <= Math.max(...xs); x++) {
      expect(grid.get(x, 29)).not.toBe(Tile.Wall);
    }
  });
});
