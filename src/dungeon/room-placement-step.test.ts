import { describe, expect, it } from 'vitest';
import type { LayoutSymmetry } from '../core/layout-symmetry';
import { Tile } from '../core/tile';
import { emptyMap } from '../pipeline/empty-map';
import type { MapState } from '../pipeline/map-state';
import { pipeline } from '../pipeline/pipeline';
import { Reserve } from '../pipeline/reserve';
import { step } from '../pipeline/step';
import { stampTile } from '../pipeline/stamp-tile';
import type { Room } from '../rooms/room';
import type { RoomTemplate } from '../rooms/templates/room-template';
import { TemplateCell } from '../rooms/templates/template-cell';
import { TemplatePlacementError } from '../rooms/templates/template-placement-error';
import { overlap, SEEDS } from '../test-helpers/dungeon-checks';
import { mulberry32 } from '../test-helpers/mulberry32';
import { placeClusteredRooms } from './place-clustered-rooms';
import { placePartitionedRooms } from './place-partitioned-rooms';
import type { RoomPlacementOptions } from './room-placement-options';
import { placeScatteredRooms } from './place-scattered-rooms';

const { Floor: F, Wall: W, Exit: E } = TemplateCell;

/** Three by three, with its exit in the top wall. */
const closet: RoomTemplate = {
  name: 'closet',
  cells: [
    [W, E, W],
    [W, F, W],
    [W, W, W],
  ],
};

/** The closet, never rotated, so its exit stays in the top wall. */
const upright: RoomTemplate = { ...closet, rotate: [0] };

type Options = RoomPlacementOptions & { spacingUniformity?: number };

/** A step that carves a block of floor, as a step of your own would. */
function carveBlock(left: number, top: number, right: number, bottom: number) {
  return step('carveBlock', {}, (state: MapState) => {
    for (let y = top; y <= bottom; ++y) {
      for (let x = left; x <= right; ++x) {
        stampTile(state, x, y, Tile.Floor);
      }
    }
    return {};
  });
}

/** Whether the floor of a room touches a tile, or comes within `gap` tiles of it. */
function near(room: Room, x: number, y: number, gap: number) {
  return (
    x >= room.x - gap &&
    x < room.x + room.width + gap &&
    y >= room.y - gap &&
    y < room.y + room.height + gap
  );
}

/** The number of tiles that differ from their mirror image about the middle of the map. */
function asymmetry(
  grid: { width: number; height: number; get(x: number, y: number): Tile },
  symmetry: LayoutSymmetry,
  lattice: boolean,
) {
  const extent = (size: number) =>
    lattice && size % 2 === 0 ? size - 1 : size;
  const [w, h] = [extent(grid.width), extent(grid.height)];
  const flipX = symmetry !== 'vertical';
  const flipY = symmetry !== 'horizontal';
  let differing = 0;
  for (let y = 0; y < grid.height; ++y) {
    for (let x = 0; x < grid.width; ++x) {
      const image = grid.get(flipX ? w - 1 - x : x, flipY ? h - 1 - y : y);
      differing += grid.get(x, y) === image ? 0 : 1;
    }
  }
  return differing;
}

describe.each([
  ['placeScatteredRooms', placeScatteredRooms],
  ['placePartitionedRooms', placePartitionedRooms],
  ['placeClusteredRooms', placeClusteredRooms],
] as const)('%s', (_name, makeStep) => {
  /** Runs the step alone on a wall map, 61 by 41 unless the size is given. */
  const place = (options: Options = {}, seed = 1, width = 61, height = 41) =>
    pipeline(
      emptyMap({ width, height, tile: Tile.Wall }),
      [makeStep(options)],
      { random: mulberry32(seed) },
    );
  const pairs = (rooms: Room[]) =>
    rooms.flatMap((a, i) => rooms.slice(i + 1).map((b) => [a, b] as const));

  it('places the same rooms from the same seed', () => {
    // given
    const options = { templates: [closet] };

    // when
    const first = place(options, 5);
    const second = place(options, 5);

    // then
    expect(first.grid.toString()).toBe(second.grid.toString());
    expect(first.rooms).toEqual(second.rooms);
  });

  it('carves the floor of every room and nothing else', () => {
    // given
    const options = { fill: 0.2 };

    // when
    const { grid, rooms } = place(options);

    // then
    const floor = rooms.reduce((sum, r) => sum + r.width * r.height, 0);
    expect(grid.toString().split('.').length - 1).toBe(floor);
    for (const room of rooms) {
      expect(grid.get(room.x, room.y)).toBe(Tile.Floor);
      expect(grid.get(room.x + room.width - 1, room.y + room.height - 1)).toBe(
        Tile.Floor,
      );
    }
  });

  it('numbers rooms by their position in the list', () => {
    // given
    const options = { roomCount: { min: 4, max: 4 } };

    // when
    const { rooms } = place(options);

    // then
    expect(rooms.map((room) => room.id)).toEqual([0, 1, 2, 3]);
  });

  it.each([1, 3, 5])('keeps rooms %i wall tiles apart', (roomSpacing) => {
    // given
    const options = { roomSpacing };

    // when
    const { rooms } = place(options);

    // then
    expect(rooms.length).toBeGreaterThan(1);
    expect(pairs(rooms).some(([a, b]) => overlap(a, b, roomSpacing))).toBe(
      false,
    );
  });

  it('keeps a wall between rooms and the map edge', () => {
    // given
    const options = { fill: 0.15 };

    // when
    const { rooms } = place(options);

    // then
    expect(
      rooms.every(
        (r) =>
          r.x >= 1 && r.y >= 1 && r.x + r.width <= 60 && r.y + r.height <= 40,
      ),
    ).toBe(true);
  });

  it('keeps room sizes within the requested ranges', () => {
    // given
    const options = {
      roomWidth: { min: 4, max: 6 },
      roomHeight: { min: 2, max: 3 },
    };

    // when
    const { rooms } = place(options);

    // then
    expect(
      rooms.every(
        (r) => r.width >= 4 && r.width <= 6 && r.height >= 2 && r.height <= 3,
      ),
    ).toBe(true);
  });

  it('reaches the target fill', () => {
    // given
    const options = { fill: 0.1 };

    // when
    const results = SEEDS.map((seed) => place(options, seed));

    // then
    for (const { rooms } of results) {
      const floor = rooms.reduce((sum, r) => sum + r.width * r.height, 0);
      expect(floor / (61 * 41)).toBeGreaterThanOrEqual(0.09);
    }
  });

  it('places the requested number of rooms', () => {
    // given
    const options = { roomCount: { min: 6, max: 6 } };

    // when
    const { rooms } = place(options);

    // then
    expect(rooms).toHaveLength(6);
  });

  it('never places more rooms than the maximum', () => {
    // given
    const options = { roomCount: { min: 1, max: 3 }, fill: 0.5 };

    // when
    const { rooms } = place(options);

    // then
    expect(rooms.length).toBeLessThanOrEqual(3);
  });

  it('places no rooms when none fits the map', () => {
    // given
    const options = {};

    // when
    const { rooms } = place(options, 1, 4, 4);

    // then
    expect(rooms).toEqual([]);
  });

  it('places no rooms when the maximum is zero', () => {
    // given
    const options = { roomCount: { min: 0, max: 0 } };

    // when
    const { rooms, roomShapes, grid } = place(options);

    // then
    expect([rooms, roomShapes, grid.toString().includes('.')]).toEqual([
      [],
      [],
      false,
    ]);
  });

  it('makes every room the middle size at full size uniformity', () => {
    // given
    const options = {
      roomWidth: { min: 3, max: 9 },
      roomHeight: { min: 3, max: 7 },
      sizeUniformity: 1,
      roomCount: { min: 1, max: 1 },
    };

    // when
    const { rooms } = place(options);

    // then
    expect(rooms.length).toBeGreaterThan(0);
    expect(rooms.every((r) => r.width === 6 && r.height === 5)).toBe(true);
  });

  it('puts lattice rooms on odd coordinates with odd sizes', () => {
    // given
    const options = {
      placement: 'lattice',
      roomSpacing: 2,
      roomWidth: { min: 4, max: 10 },
    } as const;

    // when
    const { rooms } = place(options);

    // then
    expect(rooms.length).toBeGreaterThan(1);
    expect(
      rooms.every(
        (r) =>
          r.x % 2 === 1 &&
          r.y % 2 === 1 &&
          r.width % 2 === 1 &&
          r.width >= 5 &&
          r.width <= 9 &&
          r.height % 2 === 1,
      ),
    ).toBe(true);
    // an even spacing is rounded up to an odd one
    expect(pairs(rooms).some(([a, b]) => overlap(a, b, 3))).toBe(false);
  });

  it('rounds a lattice size range without odd sizes up to the next odd size', () => {
    // given
    const options = {
      placement: 'lattice',
      fill: 0.3,
      roomWidth: { min: 4, max: 4 },
    } as const;

    // when
    const { rooms } = place(options);

    // then
    expect(rooms.length).toBeGreaterThan(0);
    expect(rooms.every((r) => r.width === 5)).toBe(true);
  });

  it('makes lattice rooms the middle odd size at full size uniformity', () => {
    // given
    const options = {
      placement: 'lattice',
      sizeUniformity: 1,
      roomCount: { min: 1, max: 1 },
    } as const;

    // when
    const { rooms } = place(options);

    // then
    expect(rooms.length).toBeGreaterThan(0);
    expect(rooms.every((r) => r.width === 5 && r.height === 5)).toBe(true);
  });

  it('places no lattice rooms when only a too large odd size exists', () => {
    // given
    const options = {
      placement: 'lattice',
      roomWidth: { min: 4, max: 4 },
    } as const;

    // when
    const { rooms } = place(options, 1, 6);

    // then
    expect(rooms).toEqual([]);
  });

  describe('shapes and the reserved mask', () => {
    it('gives every ordinary room a ring of optional exits round its floor', () => {
      // given
      const options = { roomCount: { min: 3, max: 3 } };

      // when
      const { rooms, roomShapes } = place(options);

      // then
      expect(roomShapes).toHaveLength(3);
      rooms.forEach((room, id) => {
        const shape = roomShapes[id];
        expect(shape).toMatchObject({
          x: room.x - 1,
          y: room.y - 1,
          width: room.width + 2,
          height: room.height + 2,
          doors: [],
        });
        expect(shape?.cells[0]?.[1]).toBe(TemplateCell.OptionalExit);
        expect(shape?.cells[0]?.[0]).toBe(TemplateCell.Wall);
      });
    });

    it('reserves the floor and corners as solid and the sides as openable', () => {
      // given
      const options = { roomCount: { min: 1, max: 1 } };

      // when
      const { rooms, reserved, grid } = place(options);

      // then
      const [room] = rooms as [Room];
      const at = (x: number, y: number) => reserved[y * grid.width + x];
      expect(at(room.x, room.y)).toBe(Reserve.Solid);
      expect(at(room.x - 1, room.y - 1)).toBe(Reserve.Solid);
      expect(at(room.x, room.y - 1)).toBe(Reserve.Openable);
      expect(at(room.x - 1, room.y)).toBe(Reserve.Openable);
      expect(at(room.x - 2, room.y)).toBe(Reserve.None);
    });

    it('keeps a shared wall openable, but solid where it is the corner of either room', () => {
      // given
      const options = { roomSpacing: 1, fill: 0.3 };

      // when
      const results = SEEDS.map((seed) => place(options, seed));

      // then
      let shared = 0;
      for (const { rooms, reserved, grid } of results) {
        for (const [a, b] of pairs(rooms)) {
          if (overlap(a, b, 1) || !overlap(a, b, 2)) {
            continue;
          }
          // the wall tiles of both rings
          for (let y = a.y - 1; y <= a.y + a.height; ++y) {
            for (let x = a.x - 1; x <= a.x + a.width; ++x) {
              if (!near(b, x, y, 1) || near(a, x, y, 0) || near(b, x, y, 0)) {
                continue;
              }
              const corner = (r: Room) =>
                (x === r.x - 1 || x === r.x + r.width) &&
                (y === r.y - 1 || y === r.y + r.height);
              ++shared;
              expect(reserved[y * grid.width + x]).toBe(
                corner(a) || corner(b) ? Reserve.Solid : Reserve.Openable,
              );
            }
          }
        }
      }
      expect(shared).toBeGreaterThan(0);
    });
  });

  describe('templates', () => {
    it('places templated rooms first and describes them', () => {
      // given
      const options = { templates: [closet, closet] };

      // when
      const { rooms, roomShapes } = place(options);

      // then
      expect(rooms.slice(0, 2).map((room) => room.template)).toEqual([0, 1]);
      expect(rooms.slice(2).every((room) => room.template === undefined)).toBe(
        true,
      );
      expect(roomShapes[0]?.cells).toEqual(expect.arrayContaining([[W, F, W]]));
    });

    it('lists the door of a fixed exit in the shape, and reserves it as openable', () => {
      // given
      const options = { templates: [upright] };

      // when
      const { roomShapes, reserved, grid } = place(options);

      // then
      const [shape] = roomShapes;
      expect(shape?.doors).toEqual([
        { x: (shape?.x ?? 0) + 1, y: shape?.y ?? 0, door: true },
      ]);
      const at = (x: number, y: number) => reserved[y * grid.width + x];
      expect(at((shape?.x ?? 0) + 1, shape?.y ?? 0)).toBe(Reserve.Openable);
      expect(at(shape?.x ?? 0, shape?.y ?? 0)).toBe(Reserve.Solid);
    });

    it('keeps ordinary rooms away from the tile in front of a fixed exit', () => {
      // given
      const options = {
        templates: [upright],
        fill: 0.4,
      };

      // when
      const results = SEEDS.map((seed) => place(options, seed));

      // then
      for (const { rooms, roomShapes } of results) {
        const [shape] = roomShapes;
        const front = { x: (shape?.x ?? 0) + 1, y: (shape?.y ?? 0) - 1 };
        expect(
          rooms.slice(1).some((room) => near(room, front.x, front.y, 1)),
        ).toBe(false);
      }
    });

    it('counts templated rooms towards the room count', () => {
      // given
      const options = {
        templates: [closet, closet],
        roomCount: { min: 3, max: 3 },
      };

      // when
      const { rooms } = place(options);

      // then
      expect(rooms).toHaveLength(3);
    });

    it('fails the attempt when a template finds no spot, and pipeline retries', () => {
      // given
      const full = carveBlock(1, 1, 59, 39);

      // when
      const run = () =>
        pipeline(
          emptyMap({ width: 61, height: 41, tile: Tile.Wall }),
          [full, makeStep({ templates: [closet] })],
          { random: mulberry32(1) },
        );

      // then
      expect(run).toThrow(TemplatePlacementError);
    });
  });

  describe('composition', () => {
    it('appends to the rooms of an earlier step, with ids that follow on', () => {
      // given
      const first = makeStep({ roomCount: { min: 3, max: 3 } });
      const second = makeStep({ roomCount: { min: 2, max: 2 } });

      // when
      const { rooms, roomShapes } = pipeline(
        emptyMap({ width: 61, height: 41, tile: Tile.Wall }),
        [first, second],
        { random: mulberry32(2) },
      );

      // then
      expect(rooms.map((room) => room.id)).toEqual([0, 1, 2, 3, 4]);
      expect(roomShapes).toHaveLength(5);
      for (const a of rooms.slice(0, 3)) {
        for (const b of rooms.slice(3)) {
          expect(overlap(a, b, 2)).toBe(false);
        }
      }
    });

    it('keeps ordinary rooms off floor that an earlier step made', () => {
      // given
      const block = carveBlock(20, 10, 40, 30);

      // when
      const results = SEEDS.map((seed) =>
        pipeline(
          emptyMap({ width: 61, height: 41, tile: Tile.Wall }),
          [block, makeStep({ fill: 0.2 })],
          { random: mulberry32(seed) },
        ),
      );

      // then
      for (const { rooms } of results) {
        expect(rooms.length).toBeGreaterThan(0);
        for (const room of rooms) {
          expect(
            room.x + room.width + 1 <= 20 ||
              room.x - 1 > 40 ||
              room.y + room.height + 1 <= 10 ||
              room.y - 1 > 30,
          ).toBe(true);
        }
      }
    });

    it('puts templates where an earlier step left room', () => {
      // given
      const block = carveBlock(1, 1, 40, 39);

      // when
      const results = SEEDS.map((seed) =>
        pipeline(
          emptyMap({ width: 61, height: 41, tile: Tile.Wall }),
          [
            block,
            makeStep({ templates: [closet], roomCount: { min: 0, max: 1 } }),
          ],
          { random: mulberry32(seed) },
        ),
      );

      // then
      for (const { roomShapes } of results) {
        expect(roomShapes[0]?.x).toBeGreaterThanOrEqual(41);
      }
    });

    it('puts the rooms of each copy in an area of the requested size', () => {
      // given
      const options = {
        area: { width: { min: 21, max: 21 }, height: { min: 15, max: 15 } },
        fill: 0.2,
      };

      // when
      const { rooms } = place(options);

      // then
      const left = Math.min(...rooms.map((r) => r.x));
      const right = Math.max(...rooms.map((r) => r.x + r.width));
      const top = Math.min(...rooms.map((r) => r.y));
      const bottom = Math.max(...rooms.map((r) => r.y + r.height));
      expect(rooms.length).toBeGreaterThan(0);
      expect(right - left).toBeLessThanOrEqual(19);
      expect(bottom - top).toBeLessThanOrEqual(13);
    });

    it('places rooms in two areas, apart from each other', () => {
      // given
      const options = {
        area: { width: { min: 15, max: 15 }, height: { min: 15, max: 15 } },
        count: { min: 2, max: 2 },
        roomCount: { min: 1, max: 1 },
      };

      // when
      const { rooms } = place(options);

      // then
      expect(rooms).toHaveLength(2);
      expect(rooms.map((room) => room.id)).toEqual([0, 1]);
      expect(overlap(rooms[0] as Room, rooms[1] as Room, 3)).toBe(false);
    });

    it('keeps lattice rooms in an area on the lattice of the map', () => {
      // given
      const options = {
        placement: 'lattice',
        area: { width: { min: 21, max: 25 }, height: { min: 15, max: 19 } },
        count: { min: 2, max: 2 },
      } as const;

      // when
      const results = SEEDS.map((seed) => place(options, seed));

      // then
      for (const { rooms } of results) {
        expect(rooms.every((r) => r.x % 2 === 1 && r.y % 2 === 1)).toBe(true);
      }
    });

    it('mirrors the rooms about the middle of their area', () => {
      // given
      const options = {
        symmetry: 'horizontal',
        area: { width: { min: 31, max: 31 }, height: { min: 21, max: 21 } },
        fill: 0.2,
      } as const;

      // when
      const { rooms } = place(options);

      // then
      const left = Math.min(...rooms.map((r) => r.x));
      const right = Math.max(...rooms.map((r) => r.x + r.width));
      expect(rooms.length).toBeGreaterThan(1);
      for (const room of rooms) {
        expect(
          rooms.some(
            (twin) =>
              twin.x === left + right - room.x - room.width &&
              twin.y === room.y &&
              twin.width === room.width,
          ),
        ).toBe(true);
      }
    });
  });

  describe('symmetry', () => {
    const kinds = ['horizontal', 'vertical', 'both', 'rotational'] as const;
    const cases = kinds.flatMap((kind) =>
      (['free', 'lattice'] as const).flatMap((placement) =>
        [
          [61, 41],
          [60, 40],
        ].map(([width, height]) => [kind, placement, width, height] as const),
      ),
    );

    it.each(cases)(
      'makes the %s layout symmetric with %s placement on %ix%i',
      (symmetry, placement, width, height) => {
        // given
        const options = { symmetry, placement };

        // when
        const results = SEEDS.map((seed) =>
          place(options, seed, width, height),
        );

        // then
        expect(
          results.map(({ grid }) =>
            asymmetry(grid, symmetry, placement === 'lattice'),
          ),
        ).toEqual(results.map(() => 0));
      },
    );

    it('puts a room in the middle of the map', () => {
      // given
      const options = { symmetry: 'both' } as const;

      // when
      const results = SEEDS.map((seed) => place(options, seed));

      // then
      for (const { rooms } of results) {
        expect(
          rooms.some(
            (r) => r.x + r.width / 2 === 30.5 && r.y + r.height / 2 === 20.5,
          ),
        ).toBe(true);
      }
    });

    it('counts the mirrored rooms towards the room count', () => {
      // given
      const options = {
        symmetry: 'both',
        roomCount: { min: 1, max: 9 },
      } as const;

      // when
      const results = SEEDS.map((seed) => place(options, seed));

      // then
      expect(results.every(({ rooms }) => rooms.length <= 9)).toBe(true);
    });

    it('ignores the symmetry at a chance of 0', () => {
      // given
      const plain = place({}, 3);

      // when
      const ignored = place({ symmetry: 'both', symmetryChance: 0 }, 3);

      // then
      expect(ignored.grid.toString()).toBe(plain.grid.toString());
    });

    it('brings a mirror image of a template along with templateSymmetry', () => {
      // given
      // off the axis, as placeClusteredRooms puts its first template in the middle
      const options: Options = {
        symmetry: 'horizontal',
        templateSymmetry: true,
        templates: [
          {
            ...closet,
            positions: [{ coords: { x: 10, y: 10 }, anchor: 'center' }],
          },
        ],
        roomCount: { min: 2, max: 2 },
      };

      // when
      const { rooms } = place(options);

      // then
      expect(rooms.map((room) => room.template)).toEqual([0, 0]);
      expect(rooms.map((room) => room.mirrored)).toEqual([false, true]);
    });
  });

  describe('validation', () => {
    it.each([
      ['placement', { placement: 'grid' as 'free' }],
      ['roomWidth', { roomWidth: { min: 0, max: 3 } }],
      ['roomHeight', { roomHeight: { min: 5, max: 3 } }],
      ['roomCount', { roomCount: { min: 1, max: 2.5 } }],
      ['fill', { fill: 1.5 }],
      ['roomSpacing', { roomSpacing: 0 }],
      ['doorChance', { doorChance: 2 }],
      ['sizeUniformity', { sizeUniformity: -0.1 }],
      ['spacingUniformity', { spacingUniformity: 2 }],
      ['symmetry', { symmetry: 'diagonal' as LayoutSymmetry }],
      ['symmetryChance', { symmetryChance: -1 }],
      ['count', { count: { min: -1, max: 1 } }],
      ['templates', { templates: [{ cells: [] }] }],
    ])('rejects an invalid %s when it is made', (_option, options) => {
      // given
      const invalid: Options = options;

      // when
      const make = () => makeStep(invalid);

      // then
      expect(make).toThrow(RangeError);
    });

    it('rejects a template that does not fit the lattice', () => {
      // given
      const even: RoomTemplate = {
        cells: [
          [W, E, W, W],
          [W, F, F, W],
          [W, W, W, W],
        ],
      };

      // when
      const make = () => makeStep({ placement: 'lattice', templates: [even] });

      // then
      expect(make).toThrow(RangeError);
    });

    it.each([
      ['a base other than wall', { tile: Tile.Grass }, {}],
      [
        'an area larger than the map',
        { tile: Tile.Wall },
        { area: { width: { min: 70, max: 70 } } },
      ],
      [
        'a template area outside the map',
        { tile: Tile.Wall },
        {
          templates: [
            { ...closet, areas: [{ x: 50, y: 0, width: 20, height: 10 }] },
          ],
        },
      ],
    ])('rejects %s before the first attempt', (_case, base, options) => {
      // given
      const map = emptyMap({ width: 61, height: 41, ...base });

      // when
      const run = () => pipeline(map, [makeStep(options)]);

      // then
      expect(run).toThrow(RangeError);
    });
  });
});
