import { describe, expect, it } from 'vitest';
import type { DigDungeonOptions } from './dig-dungeon-options';
import { generateDigDungeon } from './generate-dig-dungeon';
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

const { Floor: F, Wall: W, Exit: E, OptionalExit: O } = TemplateCell;

const closet: RoomTemplate = {
  name: 'closet',
  cells: [
    [W, E, W],
    [W, F, W],
    [W, W, W],
  ],
};

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

function dungeon(options: Partial<DigDungeonOptions> = {}, seed = 1) {
  return generateDigDungeon({
    width: 61,
    height: 31,
    random: mulberry32(seed),
    ...options,
  });
}

describe('generateDigDungeon with templates', () => {
  it('starts with the first template, in the middle of the map', () => {
    // given
    const templates = [hall, closet];

    // when
    const [seed] = dungeon({ templates }).rooms;

    // then
    expect([seed?.template, seed?.x, seed?.y]).toEqual([0, 26, 13]);
  });

  it('starts with the first template at its own position', () => {
    // given
    const positions = [{ coords: { x: 12, y: 8 }, anchor: 'center' as const }];

    // when
    const [seed] = dungeon({ templates: [{ ...hall, positions }] }).rooms;

    // then
    expect([seed?.x, seed?.y]).toEqual([8, 6]);
  });

  it('puts every copy of every template in the dungeon', () => {
    // given
    const templates = [hall, { ...closet, count: { min: 3, max: 3 } }];

    // when
    const { rooms } = dungeon({ templates });

    // then
    expect(rooms.filter(({ template }) => template === 1)).toHaveLength(3);
  });

  it('digs ordinary rooms too', () => {
    // given
    const templates = [hall];

    // when
    const { rooms } = dungeon({ templates, fill: 0.2 });

    // then
    expect(
      rooms.filter(({ template }) => template === undefined).length,
    ).toBeGreaterThan(2);
  });

  it('counts templated rooms towards the room count', () => {
    // given
    const templates = [hall, { ...closet, count: { min: 2, max: 2 } }];

    // when
    const { rooms } = dungeon({ templates, roomCount: { min: 6, max: 6 } });

    // then
    expect(rooms).toHaveLength(6);
  });

  it('counts templated floors towards the fill', () => {
    // given
    const templates = [hall];

    // when
    const { fill } = dungeon({ templates, roomCount: { min: 1, max: 1 } });

    // then
    expect(fill).toBeCloseTo(22 / (61 * 31), 5);
  });

  it.each(SEEDS)('joins every room (seed %i)', (seed) => {
    // given
    const templates = [hall, { ...closet, count: { min: 3, max: 3 } }];

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
    const templates = [hall, { ...closet, count: { min: 3, max: 3 } }];

    // when
    const result = dungeon({ templates }, seed);

    // then
    const seen = reachable(result, floorOf(result, 0));
    const fixed = result.exits.filter(({ rooms }) => (rooms[0] ?? 99) < 4);
    expect(fixed.length).toBeGreaterThanOrEqual(4);
    for (const { position } of fixed) {
      expect(seen.has(position.y * result.grid.width + position.x)).toBe(true);
      const open = NEIGHBORS.filter(
        (n) =>
          result.grid.get(position.x + n.x, position.y + n.y) !== Tile.Wall,
      );
      expect(open.length).toBeGreaterThanOrEqual(2);
    }
  });

  it.each(SEEDS)('keeps the rules of corridors (seed %i)', (seed) => {
    // given
    const templates = [hall, { ...closet, count: { min: 3, max: 3 } }];

    // when
    const result = dungeon({ templates }, seed);

    // then
    expect(diagonalJumps(result.grid)).toEqual([]);
    expect(touchingExits(result)).toEqual([]);
  });

  it('keeps walls', () => {
    // given
    const templates = [hall];

    // when
    const result = dungeon({ templates });

    // then
    const room = result.rooms[0];
    for (const [dy, row] of hall.cells.entries()) {
      for (const [dx, cell] of row.entries()) {
        if (cell === W) {
          expect(
            result.grid.get((room?.x ?? 0) + dx, (room?.y ?? 0) + dy),
          ).toBe(Tile.Wall);
        }
      }
    }
  });

  it('is deterministic', () => {
    // given
    const templates = [hall, { ...closet, count: { min: 2, max: 2 } }];

    // when
    const first = dungeon({ templates }, 4);
    const second = dungeon({ templates }, 4);

    // then
    expect(first.grid.toString()).toBe(second.grid.toString());
  });

  it('works with a template and no room to dig', () => {
    // given
    const templates = [closet];

    // when
    const { rooms } = dungeon({ templates, roomCount: { min: 1, max: 1 } });

    // then
    expect(rooms).toHaveLength(1);
  });

  it('works when no ordinary room fits the map', () => {
    // given
    const templates = [closet];

    // when
    const { rooms } = dungeon({
      templates,
      roomWidth: { min: 80, max: 80 },
    });

    // then
    expect(rooms).toHaveLength(1);
  });

  it('throws when a template does not fit', () => {
    // given
    const templates = [closet];

    // when
    const generate = () => dungeon({ templates, width: 3, height: 3 });

    // then
    expect(generate).toThrow(TemplatePlacementError);
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

describe('generateDigDungeon with templates on the lattice', () => {
  it.each(SEEDS)('joins every room (seed %i)', (seed) => {
    // given
    const templates = [hall, { ...closet, count: { min: 3, max: 3 } }];

    // when
    const result = dungeon({ templates, placement: 'lattice' }, seed);

    // then
    const seen = reachable(result, floorOf(result, 0));
    for (const room of result.rooms) {
      const { x, y } = floorOf(result, room.id);
      expect(seen.has(y * result.grid.width + x)).toBe(true);
      expect(
        room.template === undefined || (room.x % 2 === 0 && room.y % 2 === 0),
      ).toBe(true);
    }
  });

  it('rejects a template that does not fit the lattice', () => {
    // given
    const crooked: RoomTemplate = {
      cells: [
        [W, W, E, W],
        [W, F, F, W],
        [W, W, W, W],
      ],
    };

    // when
    const generate = () =>
      dungeon({ templates: [crooked], placement: 'lattice' });

    // then
    expect(generate).toThrow(RangeError);
  });
});

describe('generateDigDungeon with template symmetry', () => {
  it('brings a mirror image along', () => {
    // given
    const positions = [{ coords: { x: 14, y: 15 }, anchor: 'center' as const }];
    const options = {
      templates: [{ ...hall, positions }],
      layoutSymmetry: 'horizontal' as const,
      templateSymmetry: true,
    };

    // when
    const { rooms } = dungeon(options);

    // then
    expect(rooms.filter(({ template }) => template === 0)).toHaveLength(2);
  });

  it.each(SEEDS)('joins every room (seed %i)', (seed) => {
    // given
    const options = {
      templates: [hall, { ...closet, count: { min: 2, max: 2 } }],
      layoutSymmetry: 'both' as const,
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

describe('generateDigDungeon with template areas', () => {
  it('starts in the area of the first template, not in the middle', () => {
    // given
    const areas = [{ x: 0, y: 0, width: 14, height: 31 }];

    // when
    const [seed] = dungeon({ templates: [{ ...hall, areas }] }).rooms;

    // then
    expect((seed?.x ?? 99) + 9).toBeLessThanOrEqual(14);
  });
});

describe('generateDigDungeon with templates that share walls', () => {
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

describe('generateDigDungeon with a double row of templates that share a corridor', () => {
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
    const result = dungeon({ templates, height: 41 }, seed);

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
    const { grid, rooms } = dungeon({ templates, height: 41 });

    // then
    const doors = rooms
      .filter(({ template }) => template === 0)
      .flatMap(({ exits }) => exits);
    expect(doors).toHaveLength(6);
    for (let x = 1; x <= 11; x++) {
      expect(grid.get(x, 29)).not.toBe(Tile.Wall);
    }
  });
});
