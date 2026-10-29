import { describe, expect, it } from 'vitest';
import type { Area } from '../core/area';
import { Tile } from '../core/tile';
import { placeScatteredRooms } from '../dungeon/place-scattered-rooms';
import { emptyMap } from '../pipeline/empty-map';
import { pipeline } from '../pipeline/pipeline';
import { Reserve } from '../pipeline/reserve';
import { mulberry32 } from '../test-helpers/mulberry32';
import { placeCellBlocks } from './place-cell-blocks';
import type { PlaceCellBlocksOptions } from './place-cell-blocks-options';

const SEEDS = Array.from({ length: 20 }, (_, i) => i + 1);

/** Runs the step alone on a wall map of 60 by 40. */
function place(options: PlaceCellBlocksOptions = {}, seed = 1) {
  return pipeline(
    emptyMap({ width: 60, height: 40, tile: Tile.Wall }),
    [placeCellBlocks(options)],
    { random: mulberry32(seed) },
  );
}

const inside = (box: Area, x: number, y: number) =>
  x >= box.x && x < box.x + box.width && y >= box.y && y < box.y + box.height;

describe('placeCellBlocks', () => {
  it('places the same block from the same seed', () => {
    // given
    const make = () => place({}, 7);

    // when
    const [first, second] = [make(), make()];

    // then
    expect(first.grid.toString()).toBe(second.grid.toString());
    expect(first.rooms).toEqual(second.rooms);
    expect(first.roomGroups).toEqual(second.roomGroups);
  });

  it('places one block of 4 to 6 cells on each of two sides by default', () => {
    // given
    const counts = SEEDS.map((seed) => place({}, seed));

    // when
    const cells = counts.map(({ rooms }) => rooms.length);

    // then
    expect(counts.every(({ roomGroups }) => roomGroups.length === 1)).toBe(
      true,
    );
    expect(cells.every((count) => count % 2 === 0)).toBe(true);
    expect(Math.min(...cells)).toBe(8);
    expect(Math.max(...cells)).toBe(12);
  });

  it('makes every cell a room of kind cell in the group of its block', () => {
    // given
    const options = { blocks: { min: 2, max: 2 } };

    // when
    const { rooms, roomGroups } = place(options);

    // then
    expect(roomGroups).toHaveLength(2);
    expect(rooms.map(({ kind }) => kind)).toEqual(rooms.map(() => 'cell'));
    expect(new Set(rooms.map(({ group }) => group))).toEqual(new Set([0, 1]));
    for (const room of rooms) {
      const block = roomGroups[room.group ?? -1];
      expect(block && inside(block.footprint, room.x, room.y)).toBe(true);
    }
  });

  it('makes the cells of a block alike', () => {
    // given
    const options = {
      cellSize: { width: { min: 2, max: 6 }, depth: { min: 2, max: 6 } },
    };

    // when
    const sizes = SEEDS.map(
      (seed) =>
        new Set(
          place(options, seed).rooms.map(
            ({ width, height }) => `${String(width)}x${String(height)}`,
          ),
        ),
    );

    // then
    expect(sizes.every((kinds) => kinds.size === 1)).toBe(true);
  });

  it('gives every cell one door onto the corridor, which is its exit', () => {
    // given
    const options = {};

    // when
    const { grid, rooms, roomExits, roomGroups } = place(options);

    // then
    const corridor = roomGroups[0]?.corridor as Area;
    for (const room of rooms) {
      const exit = roomExits[room.exits[0] ?? -1];
      expect(room.exitCount).toBe(1);
      expect(room.doorCount).toBe(1);
      expect(exit?.door).toBe(true);
      expect(exit?.rooms).toEqual([room.id]);
      const { x, y } = exit?.position ?? { x: -1, y: -1 };
      expect(grid.get(x, y)).toBe(Tile.Door);
      const touches = [
        [x + 1, y],
        [x - 1, y],
        [x, y + 1],
        [x, y - 1],
      ].some(([nx, ny]) => inside(corridor, nx as number, ny as number));
      expect(touches).toBe(true);
    }
  });

  it('carves the cells and the corridor as floor', () => {
    // given
    const options = {};

    // when
    const { grid, rooms, roomGroups } = place(options);

    // then
    for (const floor of [...rooms, roomGroups[0]?.corridor as Area]) {
      for (let y = floor.y; y < floor.y + floor.height; ++y) {
        for (let x = floor.x; x < floor.x + floor.width; ++x) {
          expect(grid.get(x, y)).toBe(Tile.Floor);
        }
      }
    }
  });

  it('runs the corridor along the orientation', () => {
    // given
    const runs = (['horizontal', 'vertical'] as const).map((orientation) =>
      SEEDS.map((seed) => place({ orientation }, seed).roomGroups[0]?.corridor),
    );

    // when
    const [horizontal, vertical] = runs.map((corridors) =>
      corridors.map((box) => (box ? box.width > box.height : undefined)),
    );

    // then
    expect(horizontal?.every((wide) => wide === true)).toBe(true);
    expect(vertical?.every((wide) => wide === false)).toBe(true);
  });

  it('makes the corridor as wide as asked', () => {
    // given
    const options = {
      orientation: 'horizontal' as const,
      corridorWidth: { min: 3, max: 3 },
    };

    // when
    const corridor = place(options).roomGroups[0]?.corridor;

    // then
    expect(corridor?.height).toBe(3);
  });

  it('lines one side of the corridor only with sides of 1', () => {
    // given
    const options = {
      orientation: 'horizontal' as const,
      sides: { min: 1, max: 1 },
    };

    // when
    const sides = SEEDS.map((seed) => {
      const { rooms, roomGroups } = place(options, seed);
      const corridor = roomGroups[0]?.corridor as Area;
      return new Set(rooms.map(({ y }) => y < corridor.y));
    });

    // then
    expect(sides.every((above) => above.size === 1)).toBe(true);
    expect(new Set(sides.map((above) => [...above][0]))).toEqual(
      new Set([true, false]),
    );
  });

  it('centers the doors on the cell fronts by default', () => {
    // given
    const options = {
      orientation: 'horizontal' as const,
      cellSize: { width: { min: 5, max: 5 } },
    };

    // when
    const { rooms, roomExits } = place(options);

    // then
    for (const room of rooms) {
      expect(roomExits[room.exits[0] ?? -1]?.position.x).toBe(room.x + 2);
    }
  });

  it('puts the doors of a block at one jittered spot along the fronts', () => {
    // given
    const options = {
      orientation: 'horizontal' as const,
      cellSize: { width: { min: 5, max: 5 } },
      cellDoors: 'jittered' as const,
    };

    // when
    const offsets = SEEDS.map((seed) => {
      const { rooms, roomExits } = place(options, seed);
      return new Set(
        rooms.map(
          (room) => (roomExits[room.exits[0] ?? -1]?.position.x ?? 0) - room.x,
        ),
      );
    });

    // then
    expect(offsets.every((spots) => spots.size === 1)).toBe(true);
    expect(new Set(offsets.map((spots) => [...spots][0])).size).toBeGreaterThan(
      1,
    );
  });

  it('enters the block through a wall at an end of the corridor', () => {
    // given
    const options = { orientation: 'horizontal' as const };

    // when
    const { grid, roomGroups } = place(options);

    // then
    const { corridor, entrance } = roomGroups[0] ?? {};
    const { x, y, width, height } = corridor as Area;
    expect(grid.get(entrance?.x ?? -1, entrance?.y ?? -1)).toBe(Tile.Wall);
    expect([x - 1, x + width]).toContain(entrance?.x);
    expect(entrance?.y).toBeGreaterThanOrEqual(y);
    expect(entrance?.y).toBeLessThan(y + height);
  });

  it('reserves the block solid, but for its entrance, which is openable', () => {
    // given
    const options = {};

    // when
    const { grid, reserved, roomGroups } = place(options);

    // then
    const { footprint, entrance } = roomGroups[0] ?? {};
    const kinds = new Map<number, number>();
    for (let y = 0; y < grid.height; ++y) {
      for (let x = 0; x < grid.width; ++x) {
        const kind = reserved[y * grid.width + x] ?? 0;
        if (footprint && inside(footprint, x, y)) {
          kinds.set(kind, (kinds.get(kind) ?? 0) + 1);
        } else {
          expect(kind).toBe(Reserve.None);
        }
      }
    }
    expect(kinds.get(Reserve.Openable)).toBe(1);
    expect(kinds.get(Reserve.None)).toBeUndefined();
    expect(reserved[(entrance?.y ?? 0) * grid.width + (entrance?.x ?? 0)]).toBe(
      Reserve.Openable,
    );
  });

  it('gives each cell a shape of its floor and walls, with its door', () => {
    // given
    const options = {};

    // when
    const { rooms, roomShapes } = place(options);

    // then
    expect(roomShapes).toHaveLength(rooms.length);
    for (const room of rooms) {
      const shape = roomShapes[room.id];
      expect([shape?.x, shape?.y, shape?.width, shape?.height]).toEqual([
        room.x - 1,
        room.y - 1,
        room.width + 2,
        room.height + 2,
      ]);
      expect(shape?.doors).toHaveLength(1);
    }
  });

  it('places blocks in each of the areas', () => {
    // given
    const options = {
      area: { width: { min: 28, max: 28 }, height: { min: 18, max: 18 } },
      count: { min: 2, max: 2 },
      cellsPerSide: { min: 3, max: 3 },
    };

    // when
    const { roomGroups } = place(options);

    // then
    expect(roomGroups).toHaveLength(2);
  });

  it('follows on from the rooms of the steps before it', () => {
    // given
    const base = emptyMap({ width: 60, height: 40, tile: Tile.Wall });

    // when
    const { rooms, roomExits } = pipeline(
      base,
      [
        placeScatteredRooms({ roomCount: { min: 2, max: 2 } }),
        placeCellBlocks(),
      ],
      { random: mulberry32(1) },
    );

    // then
    expect(rooms.map(({ id }) => id)).toEqual(rooms.map((_, index) => index));
    expect(rooms.slice(0, 2).map(({ kind }) => kind)).toEqual(['room', 'room']);
    const firstCell = rooms[2];
    expect(firstCell?.kind).toBe('cell');
    expect(roomExits[firstCell?.exits[0] ?? -1]?.rooms).toEqual([2]);
  });

  describe('with a guard room beside it', () => {
    const guarded = (options: PlaceCellBlocksOptions = {}, seed = 1) =>
      place({ orientation: 'horizontal', guardRoom: {}, ...options }, seed);

    it('adds a guard room of kind guardRoom in the group of its block', () => {
      // given
      const options = { blocks: { min: 2, max: 2 } };

      // when
      const { rooms } = guarded(options);

      // then
      const guards = rooms.filter(({ kind }) => kind === 'guardRoom');
      expect(guards.map(({ group }) => group)).toEqual([0, 1]);
    });

    it('makes the guard room as big as asked', () => {
      // given
      const options = {
        guardRoom: {
          size: { width: { min: 7, max: 7 }, depth: { min: 2, max: 2 } },
        },
      };

      // when
      const guard = guarded(options).rooms.find(
        ({ kind }) => kind === 'guardRoom',
      );

      // then
      expect([guard?.width, guard?.height]).toEqual([7, 2]);
    });

    it('gives the guard room one door onto the tunnel', () => {
      // given
      const options = {};

      // when
      const { grid, rooms, roomExits, roomGroups } = guarded(options);

      // then
      const guard = rooms.find(({ kind }) => kind === 'guardRoom');
      const tunnel = roomGroups[0]?.tunnel as Area;
      const exit = roomExits[guard?.exits[0] ?? -1];
      const { x, y } = exit?.position ?? { x: -1, y: -1 };
      expect([guard?.exitCount, guard?.doorCount, exit?.door]).toEqual([
        1,
        1,
        true,
      ]);
      expect(grid.get(x, y)).toBe(Tile.Door);
      expect(inside(tunnel, x, y - 1) || inside(tunnel, x, y + 1)).toBe(true);
    });

    it('runs the tunnel from a door at the end of the corridor', () => {
      // given
      const options = {};

      // when
      const { grid, roomGroups } = guarded(options);

      // then
      const { corridor, tunnel } = roomGroups[0] ?? {};
      const [c, t] = [corridor as Area, tunnel as Area];
      const door = t.x < c.x ? c.x - 1 : c.x + c.width;
      expect(t.height).toBe(1);
      expect(grid.get(door, t.y)).toBe(Tile.Door);
      expect([t.x - 1, t.x + t.width]).toContain(door);
      for (let x = t.x; x < t.x + t.width; ++x) {
        expect(grid.get(x, t.y)).toBe(Tile.Floor);
      }
    });

    it('moves the entrance to the wall beyond the tunnel', () => {
      // given
      const options = {};

      // when
      const { grid, reserved, roomGroups } = guarded(options);

      // then
      const { tunnel, entrance } = roomGroups[0] ?? {};
      const { x, y, width } = tunnel as Area;
      expect(entrance?.y).toBe(y);
      expect([x - 1, x + width]).toContain(entrance?.x);
      expect(grid.get(entrance?.x ?? -1, y)).toBe(Tile.Wall);
      expect(reserved[y * grid.width + (entrance?.x ?? 0)]).toBe(
        Reserve.Openable,
      );
    });

    it('runs the tunnel as many tiles past the guard room door as asked', () => {
      // given
      const options = { guardRoom: { tunnel: { min: 3, max: 3 } } };

      // when
      const { rooms, roomExits, roomGroups } = guarded(options);

      // then
      const guard = rooms.find(({ kind }) => kind === 'guardRoom');
      const door = roomExits[guard?.exits[0] ?? -1]?.position.x ?? 0;
      const entrance = roomGroups[0]?.entrance.x ?? 0;
      expect(Math.abs(entrance - door)).toBe(4);
    });

    it('reserves the guard room and the tunnel with their walls solid', () => {
      // given
      const options = {};

      // when
      const { grid, reserved, rooms, roomGroups } = guarded(options);

      // then
      const guard = rooms.find(({ kind }) => kind === 'guardRoom') as Area;
      const { tunnel, entrance } = roomGroups[0] ?? {};
      const t = tunnel as Area;
      const at = (x: number, y: number) => reserved[y * grid.width + x];
      for (let y = guard.y - 1; y <= guard.y + guard.height; ++y) {
        for (let x = guard.x - 1; x <= guard.x + guard.width; ++x) {
          expect(at(x, y)).toBe(Reserve.Solid);
        }
      }
      for (let x = t.x; x < t.x + t.width; ++x) {
        expect([at(x, t.y - 1), at(x, t.y), at(x, t.y + 1)]).toEqual([
          Reserve.Solid,
          Reserve.Solid,
          Reserve.Solid,
        ]);
      }
      expect(at(entrance?.x ?? 0, entrance?.y ?? 0)).toBe(Reserve.Openable);
    });

    it('puts the guard room on either side of the tunnel', () => {
      // given
      const runs = SEEDS.map((seed) => guarded({}, seed));

      // when
      const above = runs.map(({ rooms, roomGroups }) => {
        const guard = rooms.find(({ kind }) => kind === 'guardRoom');
        return (guard?.y ?? 0) < (roomGroups[0]?.tunnel?.y ?? 0);
      });

      // then
      expect(new Set(above)).toEqual(new Set([true, false]));
    });

    it('leaves blocks without a guard room with a chance of 0', () => {
      // given
      const options = { guardRoom: { chance: 0 } };

      // when
      const { rooms, roomGroups } = guarded(options);

      // then
      expect(rooms.map(({ kind }) => kind)).toEqual(rooms.map(() => 'cell'));
      expect(roomGroups[0]?.tunnel).toBeUndefined();
    });

    it('places no guard room without the option', () => {
      // given
      const options = {};

      // when
      const { rooms, roomGroups } = place(options);

      // then
      expect(rooms.map(({ kind }) => kind)).toEqual(rooms.map(() => 'cell'));
      expect(roomGroups[0]?.tunnel).toBeUndefined();
    });
  });

  it('throws an error when no spot fits the block', () => {
    // given
    const state = emptyMap({ width: 12, height: 12, tile: Tile.Wall })();
    const blocks = placeCellBlocks();

    // when
    const lay = () => blocks(state, { random: mulberry32(1) });

    // then
    expect(lay).toThrow(/No free spot for a cell block/);
  });

  it('refuses a map that does not start as wall', () => {
    // given
    const base = emptyMap({ width: 60, height: 40, tile: Tile.Floor });

    // when
    const run = () => pipeline(base, [placeCellBlocks()]);

    // then
    expect(run).toThrow(RangeError);
  });

  it.each([
    ['blocks', { blocks: { min: -1, max: 1 } }],
    ['cellSize.width', { cellSize: { width: { min: 0, max: 3 } } }],
    ['cellSize.depth', { cellSize: { depth: { min: 2, max: 1 } } }],
    ['cellsPerSide', { cellsPerSide: { min: 0, max: 2 } }],
    ['sides below 1', { sides: { min: 0, max: 1 } }],
    ['sides above 2', { sides: { min: 1, max: 3 } }],
    ['corridorWidth', { corridorWidth: { min: 1.5, max: 2 } }],
    ['count', { count: { min: -1, max: 0 } }],
    ['orientation', { orientation: 'diagonal' as 'any' }],
    ['cellDoors', { cellDoors: 'random' as 'centered' }],
    ['guardRoom.chance', { guardRoom: { chance: 1.5 } }],
    [
      'guardRoom.size.width',
      { guardRoom: { size: { width: { min: 0, max: 2 } } } },
    ],
    [
      'guardRoom.size.depth',
      { guardRoom: { size: { depth: { min: 3, max: 2 } } } },
    ],
    ['guardRoom.tunnel', { guardRoom: { tunnel: { min: -1, max: 2 } } }],
    [
      'guardRoom.placement',
      { guardRoom: { placement: 'through' as 'beside' } },
    ],
  ])('rejects a bad %s', (_, options) => {
    // given
    const make = () => placeCellBlocks(options);

    // when / then
    expect(make).toThrow(RangeError);
  });
});
