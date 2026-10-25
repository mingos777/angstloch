import { describe, expect, it } from 'vitest';
import type { DigDungeonOptions } from './dig-dungeon-options';
import { generateDigDungeon } from './generate-dig-dungeon';
import type { Room } from '../rooms/room';
import {
  NEIGHBORS,
  SEEDS,
  allTiles,
  asymmetry,
  corridorTiles,
  deadEnds,
  diagonalJumps,
  inRoom,
  isConnected,
  overlap,
  roomAt,
  touchingExits,
} from '../test-helpers/dungeon-checks';
import { mulberry32 } from '../test-helpers/mulberry32';
import { Tile } from '../core/tile';

function dungeon(options: Partial<DigDungeonOptions> = {}, seed = 1) {
  return generateDigDungeon({
    width: 61,
    height: 41,
    random: mulberry32(seed),
    ...options,
  });
}

function manyDungeons(options: Partial<DigDungeonOptions> = {}) {
  return SEEDS.map((seed) => dungeon(options, seed));
}

describe('generateDigDungeon', () => {
  it('produces a grid of the requested size', () => {
    // given
    const options = { width: 30, height: 20 };

    // when
    const { grid } = dungeon(options);

    // then
    expect([grid.width, grid.height]).toEqual([30, 20]);
  });

  it('is deterministic for a given random source', () => {
    // given
    const options = {};

    // when
    const first = dungeon(options, 7);
    const second = dungeon(options, 7);

    // then
    expect(first.grid.toString()).toBe(second.grid.toString());
  });

  it('starts with a room in the middle of the map', () => {
    // given
    const options = { roomCount: { min: 1, max: 1 } };

    // when
    const { rooms } = dungeon(options);

    // then
    const [room] = rooms as [Room];
    expect(Math.abs(room.x + room.width / 2 - 30.5)).toBeLessThanOrEqual(1.5);
    expect(Math.abs(room.y + room.height / 2 - 20.5)).toBeLessThanOrEqual(1.5);
  });

  it('numbers rooms by their position in the list', () => {
    // given
    const options = {};

    // when
    const { rooms } = dungeon(options);

    // then
    expect(rooms.map((room) => room.id)).toEqual(rooms.map((_, i) => i));
  });

  it('carves the floor of every room', () => {
    // given
    const options = {};

    // when
    const { rooms, grid } = dungeon(options);

    // then
    const tiles = rooms.flatMap((room) =>
      allTiles(grid).filter(({ x, y }) => inRoom(room, x, y)),
    );
    expect(tiles.every(({ x, y }) => grid.get(x, y) === Tile.Floor)).toBe(true);
  });

  it.each([1, 3, 5])('keeps rooms %i wall tiles apart', (roomSpacing) => {
    // given
    const options = { roomSpacing };

    // when
    const results = manyDungeons(options);

    // then
    const close = results.flatMap(({ rooms }) =>
      rooms.flatMap((a, i) =>
        rooms.slice(i + 1).filter((b) => overlap(a, b, roomSpacing)),
      ),
    );
    expect(close).toEqual([]);
  });

  it('keeps a wall between rooms and the map edge', () => {
    // given
    const options = { fill: 0.15 };

    // when
    const results = manyDungeons(options);

    // then
    expect(
      results
        .flatMap(({ rooms }) => rooms)
        .every(
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
    const results = manyDungeons(options);

    // then
    expect(
      results
        .flatMap(({ rooms }) => rooms)
        .every(
          (r) => r.width >= 4 && r.width <= 6 && r.height >= 2 && r.height <= 3,
        ),
    ).toBe(true);
  });

  it('makes every room the middle size at full size uniformity', () => {
    // given
    const options = {
      roomWidth: { min: 3, max: 9 },
      roomHeight: { min: 3, max: 7 },
      sizeUniformity: 1,
    };

    // when
    const { rooms } = dungeon(options);

    // then
    expect(rooms.every((r) => r.width === 6 && r.height === 5)).toBe(true);
  });

  it('reaches the target fill', () => {
    // given
    const options = { fill: 0.1 };

    // when
    const results = manyDungeons(options);

    // then
    expect(results.every(({ fill }) => fill >= 0.1)).toBe(true);
  });

  it('reports the actual fill', () => {
    // given
    const options = {};

    // when
    const { fill, rooms } = dungeon(options);

    // then
    const area = rooms.reduce((sum, r) => sum + r.width * r.height, 0);
    expect(fill).toBeCloseTo(area / (61 * 41));
  });

  it('digs the requested number of rooms', () => {
    // given
    const options = { roomCount: { min: 7, max: 7 } };

    // when
    const { rooms } = dungeon(options);

    // then
    expect(rooms).toHaveLength(7);
  });

  it('never digs more rooms than the maximum', () => {
    // given
    const options = { roomCount: { min: 1, max: 3 }, fill: 0.5 };

    // when
    const { rooms } = dungeon(options);

    // then
    expect(rooms).toHaveLength(3);
  });

  it('digs no rooms when the maximum is zero', () => {
    // given
    const options = { roomCount: { min: 0, max: 0 } };

    // when
    const { rooms, exits, grid } = dungeon(options);

    // then
    expect([rooms, exits, grid.toString().includes('.')]).toEqual([
      [],
      [],
      false,
    ]);
  });

  it('digs no rooms when none fits the map', () => {
    // given
    const options = { width: 4, height: 4 };

    // when
    const { rooms } = dungeon(options);

    // then
    expect(rooms).toEqual([]);
  });

  it('digs fewer rooms than requested when the map is full', () => {
    // given
    const options = { width: 20, height: 20, roomCount: { min: 50, max: 50 } };

    // when
    const { rooms } = dungeon(options);

    // then
    expect(rooms.length).toBeLessThan(50);
  });

  describe('connections', () => {
    it.each(['free', 'lattice'] as const)(
      'makes every room reachable from the first with %s placement',
      (placement) => {
        // given
        const options = { placement };

        // when
        const results = manyDungeons(options);

        // then
        expect(results.every(isConnected)).toBe(true);
      },
    );

    it.each([
      [
        { min: 1, max: 1 },
        { min: 1, max: 8 },
      ],
      [
        { min: 2, max: 4 },
        { min: 1, max: 8 },
      ],
      [
        { min: 1, max: 3 },
        { min: 0, max: 4 },
      ],
      [
        { min: 1, max: 3 },
        { min: 6, max: 12 },
      ],
    ])(
      'keeps every room reachable with %j exits and corridors of %j',
      (exitsPerRoom, corridorLength) => {
        // given
        const options = { exitsPerRoom, corridorLength, deadEndChance: 1 };

        // when
        const results = manyDungeons(options);

        // then
        expect(results.every(isConnected)).toBe(true);
      },
    );

    it('gives every room an exit', () => {
      // given
      const options = {};

      // when
      const results = manyDungeons(options);

      // then
      expect(
        results.every(({ rooms }) => rooms.every((r) => r.exitCount >= 1)),
      ).toBe(true);
    });

    it('lists each exit on the rooms it belongs to', () => {
      // given
      const options = {};

      // when
      const { rooms, exits } = dungeon(options);

      // then
      expect(
        exits.every((exit, index) =>
          exit.rooms.every((id) => rooms[id]?.exits.includes(index)),
        ),
      ).toBe(true);
    });

    it('counts the exits and doors of a room', () => {
      // given
      const options = { doorChance: 0.5 };

      // when
      const { rooms, exits } = dungeon(options);

      // then
      expect(
        rooms.every(
          (room) =>
            room.exitCount === room.exits.length &&
            room.doorCount ===
              room.exits.filter((index) => exits[index]?.door).length,
        ),
      ).toBe(true);
    });

    it('puts every exit in the wall right next to its room', () => {
      // given
      const options = {};

      // when
      const { rooms, exits } = dungeon(options);

      // then
      expect(
        exits.every(({ position, rooms: ids }) =>
          ids.every((id) =>
            NEIGHBORS.some(({ x, y }) =>
              inRoom(rooms[id] as Room, position.x + x, position.y + y),
            ),
          ),
        ),
      ).toBe(true);
    });

    it('opens a gap at every exit', () => {
      // given
      const options = { doorChance: 0.5 };

      // when
      const { grid, exits } = dungeon(options);

      // then
      expect(
        exits.every(
          ({ position, door }) =>
            grid.get(position.x, position.y) ===
            (door ? Tile.Door : Tile.Floor),
        ),
      ).toBe(true);
    });

    it('places a door at every exit by default', () => {
      // given
      const options = {};

      // when
      const { exits } = dungeon(options);

      // then
      expect(exits.every((exit) => exit.door)).toBe(true);
    });

    it('places no doors with a door chance of zero', () => {
      // given
      const options = { doorChance: 0 };

      // when
      const { grid, exits } = dungeon(options);

      // then
      expect([
        exits.some((exit) => exit.door),
        grid.toString().includes('+'),
      ]).toEqual([false, false]);
    });

    it('keeps exits apart from each other', () => {
      // given
      const options = { roomSpacing: 3 };

      // when
      const results = manyDungeons(options);

      // then
      expect(results.flatMap(touchingExits)).toEqual([]);
    });

    it('only opens the wall of a room at its exits', () => {
      // given
      const options = { roomSpacing: 3 };

      // when
      const { grid, rooms, exits } = dungeon(options);

      // then
      const isExit = (x: number, y: number) =>
        exits.some(({ position }) => position.x === x && position.y === y);
      const leaks = allTiles(grid).filter(
        ({ x, y }) =>
          grid.get(x, y) !== Tile.Wall &&
          !roomAt(rooms, x, y) &&
          !isExit(x, y) &&
          NEIGHBORS.some(({ x: dx, y: dy }) => roomAt(rooms, x + dx, y + dy)),
      );
      expect(leaks).toEqual([]);
    });
  });

  describe('corridors', () => {
    it.each([0, 0.5, 1])(
      'never makes a section two tiles wide or a diagonal jump with straight %f',
      (straight) => {
        // given
        const options = { straight, deadEndChance: 0.5, loopChance: 0.5 };

        // when
        const results = manyDungeons(options);

        // then
        const wide = results.flatMap(({ grid, rooms }) =>
          allTiles(grid).filter((tile) => {
            const block = [
              tile,
              { x: tile.x + 1, y: tile.y },
              { x: tile.x, y: tile.y + 1 },
              { x: tile.x + 1, y: tile.y + 1 },
            ];
            return (
              block.every(({ x, y }) => grid.get(x, y) !== Tile.Wall) &&
              !block.every(({ x, y }) => roomAt(rooms, x, y))
            );
          }),
        );
        expect(wide).toEqual([]);
        expect(results.flatMap(({ grid }) => diagonalJumps(grid))).toEqual([]);
      },
    );

    it('joins rooms with a door in the wall between them for a corridor length of zero', () => {
      // given
      const options = {
        corridorLength: { min: 0, max: 0 },
        exitsPerRoom: { min: 1, max: 1 },
        loopChance: 0,
      };

      // when
      const results = manyDungeons(options);

      // then
      // the only open tiles outside rooms are the doors themselves
      expect(
        results.every(
          (result) => corridorTiles(result).length === result.exits.length,
        ),
      ).toBe(true);
      expect(
        results.every(({ exits }) => exits.every((e) => e.rooms.length === 2)),
      ).toBe(true);
    });

    it('digs longer corridors with a longer corridor length', () => {
      // given
      const tilesPerRoom = (corridorLength: { min: number; max: number }) => {
        const results = manyDungeons({
          corridorLength,
          loopChance: 0,
          roomSpacing: 3,
        });
        const tiles = results.reduce((s, r) => s + corridorTiles(r).length, 0);
        const rooms = results.reduce((s, r) => s + r.rooms.length, 0);
        return tiles / rooms;
      };

      // when
      const short = tilesPerRoom({ min: 1, max: 2 });
      const long = tilesPerRoom({ min: 8, max: 12 });

      // then
      expect(long).toBeGreaterThan(short * 2);
    });

    it('branches off corridors more with a higher branch chance', () => {
      // given
      const junctions = (branchChance: number) =>
        manyDungeons({ branchChance, loopChance: 0 }).reduce(
          (sum, result) =>
            sum +
            corridorTiles(result).filter(
              ({ x, y }) =>
                NEIGHBORS.filter(
                  (n) => result.grid.get(x + n.x, y + n.y) !== Tile.Wall,
                ).length >= 3,
            ).length,
          0,
        );

      // when
      const rare = junctions(0);
      const often = junctions(1);

      // then
      expect(often).toBeGreaterThan(rare);
    });

    it('leaves rooms sideways more often with a horizontal bias', () => {
      // given
      const sidewaysShare = (horizontalBias: number, verticalBias: number) => {
        let sideways = 0;
        let total = 0;
        for (const { rooms, exits } of manyDungeons({
          horizontalBias,
          verticalBias,
          roomSpacing: 3,
          loopChance: 0,
        })) {
          for (const { position, rooms: ids } of exits) {
            const room = rooms[ids[0] as number] as Room;
            sideways +=
              inRoom(room, position.x - 1, position.y) ||
              inRoom(room, position.x + 1, position.y)
                ? 1
                : 0;
            ++total;
          }
        }
        return sideways / total;
      };

      // when
      const horizontalLean = sidewaysShare(1, 0);
      const verticalLean = sidewaysShare(0, 1);

      // then
      expect(horizontalLean).toBeGreaterThan(verticalLean + 0.2);
    });

    it('turns less with a higher straight preference', () => {
      // given
      const turns = (straight: number) =>
        manyDungeons({
          straight,
          loopChance: 0,
          corridorLength: { min: 6, max: 10 },
        }).reduce(
          (sum, { grid, rooms }) =>
            sum +
            allTiles(grid).filter(({ x, y }) => {
              const open = (dx: number, dy: number) =>
                grid.get(x + dx, y + dy) !== Tile.Wall;
              return (
                grid.get(x, y) === Tile.Floor &&
                !roomAt(rooms, x, y) &&
                (open(1, 0) || open(-1, 0)) &&
                (open(0, 1) || open(0, -1))
              );
            }).length,
          0,
        );

      // when
      const wandering = turns(0);
      const straight = turns(1);

      // then
      expect(straight).toBeLessThan(wandering);
    });
  });

  describe('exits per room', () => {
    const base = { loopChance: 0 };

    const averageExits = (options: Partial<DigDungeonOptions>) => {
      const counts = manyDungeons({ ...base, ...options }).flatMap(
        ({ rooms }) => rooms.map((r) => r.exitCount),
      );
      return counts.reduce((a, b) => a + b, 0) / counts.length;
    };

    it('gives rooms more exits when asked for more', () => {
      // given
      const few = { exitsPerRoom: { min: 1, max: 1 } };
      const many = { exitsPerRoom: { min: 3, max: 3 } };

      // when
      const [fewer, more] = [averageExits(few), averageExits(many)];

      // then
      expect(more).toBeGreaterThan(fewer + 0.8);
    });

    it('draws the number of exits of each room from the range', () => {
      // given
      const options = { exitsPerRoom: { min: 1, max: 3 } };

      // when
      const counts = manyDungeons(options).flatMap(({ rooms }) =>
        rooms.map((r) => r.exitCount),
      );

      // then
      expect([1, 2, 3].every((n) => counts.includes(n))).toBe(true);
    });
  });

  describe('loops and dead ends', () => {
    it('builds no dead ends by default', () => {
      // given
      const options = {};

      // when
      const results = manyDungeons(options);

      // then
      expect(results.flatMap(deadEnds)).toEqual([]);
    });

    it('builds dead ends with a dead end chance of one', () => {
      // given
      const options = { deadEndChance: 1 };

      // when
      const results = manyDungeons(options);

      // then
      expect(results.flatMap(deadEnds).length).toBeGreaterThan(SEEDS.length);
    });

    it('adds corridors with a higher loop chance', () => {
      // given
      const tiles = (loopChance: number) =>
        manyDungeons({ loopChance, exitsPerRoom: { min: 1, max: 1 } }).reduce(
          (sum, result) => sum + corridorTiles(result).length,
          0,
        );

      // when
      const none = tiles(0);
      const all = tiles(1);

      // then
      expect(all).toBeGreaterThan(none);
    });
  });

  describe('lattice placement', () => {
    const lattice = { placement: 'lattice' } as const;

    it('puts rooms on odd coordinates with odd sizes', () => {
      // given
      const options = { ...lattice, roomSpacing: 2 };

      // when
      const results = manyDungeons(options);

      // then
      expect(
        results
          .flatMap(({ rooms }) => rooms)
          .every(
            (r) =>
              r.x % 2 === 1 &&
              r.y % 2 === 1 &&
              r.width % 2 === 1 &&
              r.height % 2 === 1,
          ),
      ).toBe(true);
    });

    it('keeps rooms three tiles apart for a room spacing of two', () => {
      // given
      const options = { ...lattice, roomSpacing: 2 };

      // when
      const results = manyDungeons(options);

      // then
      const close = results.flatMap(({ rooms }) =>
        rooms.flatMap((a, i) =>
          rooms.slice(i + 1).filter((b) => overlap(a, b, 3)),
        ),
      );
      expect(close).toEqual([]);
    });

    it('keeps corridors off the corners between lattice cells', () => {
      // given
      const options = { ...lattice, deadEndChance: 0.5, loopChance: 0.5 };

      // when
      const results = manyDungeons(options);

      // then
      const stray = results.flatMap((result) =>
        corridorTiles(result).filter(({ x, y }) => x % 2 === 0 && y % 2 === 0),
      );
      expect(stray).toEqual([]);
    });

    it('puts exits on odd coordinates along the wall', () => {
      // given
      const options = lattice;

      // when
      const results = manyDungeons(options);

      // then
      expect(
        results
          .flatMap(({ exits }) => exits)
          .every(({ position }) => (position.x + position.y) % 2 === 1),
      ).toBe(true);
    });
  });

  describe('layout symmetry', () => {
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
      (layoutSymmetry, placement, width, height) => {
        // given
        const options = {
          layoutSymmetry,
          placement,
          width,
          height,
          deadEndChance: 0.3,
          loopChance: 0.3,
        };

        // when
        const results = manyDungeons(options);

        // then
        expect(
          results.map((result) =>
            asymmetry(result, layoutSymmetry, placement === 'lattice'),
          ),
        ).toEqual(results.map(() => 0));
      },
    );

    it('mirrors four ways with both', () => {
      // given
      const options = { layoutSymmetry: 'both', deadEndChance: 0.3 } as const;

      // when
      const results = manyDungeons(options);

      // then
      expect(
        results.every(
          (result) =>
            asymmetry(result, 'horizontal', false) +
              asymmetry(result, 'vertical', false) ===
            0,
        ),
      ).toBe(true);
    });

    it('makes a different dungeon than without symmetry', () => {
      // given
      const options = { layoutSymmetry: 'both' } as const;

      // when
      const symmetric = dungeon(options);
      const plain = dungeon({});

      // then
      expect(symmetric.grid.toString()).not.toBe(plain.grid.toString());
    });

    it.each(kinds)(
      'keeps %s dungeons connected, free of jumps and rooms apart',
      (layoutSymmetry) => {
        // given
        const options = { layoutSymmetry, roomSpacing: 2 };

        // when
        const results = manyDungeons(options);

        // then
        for (const result of results) {
          expect(isConnected(result)).toBe(true);
          expect(diagonalJumps(result.grid)).toEqual([]);
          for (const [i, a] of result.rooms.entries()) {
            for (const b of result.rooms.slice(i + 1)) {
              expect(overlap(a, b, 2)).toBe(false);
            }
          }
        }
      },
    );

    it('keeps the numbering and exit counts of rooms consistent', () => {
      // given
      const options = {
        layoutSymmetry: 'rotational',
        loopChance: 0.5,
      } as const;

      // when
      const results = manyDungeons(options);

      // then
      for (const { rooms, exits } of results) {
        expect(rooms.map(({ id }) => id)).toEqual(rooms.map((_r, i) => i));
        for (const room of rooms) {
          expect(
            exits.filter(({ rooms: ids }) => ids.includes(room.id)).length,
          ).toBe(room.exitCount);
        }
      }
    });

    it('counts the mirrored rooms towards the room count', () => {
      // given
      const options = {
        layoutSymmetry: 'both',
        roomCount: { min: 1, max: 6 },
      } as const;

      // when
      const results = manyDungeons(options);

      // then
      expect(results.every(({ rooms }) => rooms.length <= 6)).toBe(true);
    });

    it('counts the mirrored rooms towards the fill', () => {
      // given
      const options = { layoutSymmetry: 'both', fill: 0.15 } as const;

      // when
      const results = manyDungeons(options);

      // then
      for (const { rooms, fill } of results) {
        const covered = rooms.reduce((sum, r) => sum + r.width * r.height, 0);
        expect(fill).toBeCloseTo(covered / (61 * 41));
        expect(fill).toBeGreaterThanOrEqual(0.15);
      }
    });

    it('puts a room on the axis to start with', () => {
      // given
      const options = {
        layoutSymmetry: 'both',
        roomCount: { min: 1, max: 1 },
      } as const;

      // when
      const results = manyDungeons(options);

      // then
      for (const { rooms } of results) {
        const [room] = rooms as [Room];
        expect(room.x + room.width / 2).toBe(30.5);
        expect(room.y + room.height / 2).toBe(20.5);
      }
    });

    it('gives mirrored exits the same doors', () => {
      // given
      const options = {
        layoutSymmetry: 'horizontal',
        doorChance: 0.5,
      } as const;

      // when
      const results = manyDungeons(options);

      // then
      expect(
        results.map((result) => asymmetry(result, 'horizontal', false)),
      ).toEqual(results.map(() => 0));
      expect(results.some(({ exits }) => exits.some(({ door }) => !door))).toBe(
        true,
      );
    });

    it('ignores the symmetry at a chance of 0', () => {
      // given
      const plain = dungeon({}, 3);

      // when
      const ignored = dungeon(
        { layoutSymmetry: 'both', layoutSymmetryChance: 0 },
        3,
      );

      // then
      expect(ignored.grid.toString()).toBe(plain.grid.toString());
    });

    it('leaves rooms without twins at a chance between 0 and 1', () => {
      // given
      const options = {
        layoutSymmetry: 'horizontal',
        layoutSymmetryChance: 0.5,
      } as const;

      // when
      const results = manyDungeons(options);

      // then
      const differing = results.map((result) =>
        asymmetry(result, 'horizontal', false),
      );
      expect(differing.some((count) => count > 0)).toBe(true);
      expect(results.every(isConnected)).toBe(true);
    });

    it('is less symmetric at a lower chance', () => {
      // given
      const total = (layoutSymmetryChance: number) =>
        manyDungeons({ layoutSymmetry: 'horizontal', layoutSymmetryChance })
          .map((result) => asymmetry(result, 'horizontal', false))
          .reduce((a, b) => a + b, 0);

      // when
      const [low, high] = [total(0.3), total(0.9)];

      // then
      expect(low).toBeGreaterThan(high);
    });

    it('still fits one room on a map that is just big enough', () => {
      // given
      const options = {
        width: 9,
        height: 9,
        layoutSymmetry: 'both',
        roomWidth: { min: 3, max: 3 },
        roomHeight: { min: 3, max: 3 },
      } as const;

      // when
      const { rooms } = dungeon(options);

      // then
      expect(rooms.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('corridor symmetry', () => {
    it.each(['whirlpool', 'snowflake'] as const)(
      'lays out corridors differently with %s symmetry',
      (corridorSymmetry) => {
        // given
        const options = { corridorSymmetry };

        // when
        const symmetric = dungeon(options);
        const plain = dungeon({});

        // then
        expect(symmetric.grid.toString()).not.toBe(plain.grid.toString());
      },
    );

    it.each(['whirlpool', 'snowflake'] as const)(
      'keeps %s dungeons connected and free of jumps',
      (corridorSymmetry) => {
        // given
        const options = { corridorSymmetry, straight: 0.2 };

        // when
        const results = manyDungeons(options);

        // then
        for (const result of results) {
          expect(isConnected(result)).toBe(true);
          expect(diagonalJumps(result.grid)).toEqual([]);
        }
      },
    );

    it('ignores the symmetry at a chance of 0', () => {
      // given
      const plain = dungeon({}, 3);

      // when
      const ignored = dungeon(
        { corridorSymmetry: 'snowflake', corridorSymmetryChance: 0 },
        3,
      );

      // then
      expect(ignored.grid.toString()).toBe(plain.grid.toString());
    });

    it('combines with a symmetric layout', () => {
      // given
      const options = {
        layoutSymmetry: 'both',
        corridorSymmetry: 'whirlpool',
      } as const;

      // when
      const results = manyDungeons(options);

      // then
      expect(results.map((result) => asymmetry(result, 'both', false))).toEqual(
        results.map(() => 0),
      );
    });
  });

  describe('validation', () => {
    it.each([
      ['width', { width: 0 }],
      ['fill', { fill: 1.5 }],
      ['roomSpacing', { roomSpacing: 0 }],
      ['exitsPerRoom', { exitsPerRoom: { min: 0, max: 1 } }],
      ['loopChance', { loopChance: 2 }],
      ['corridorLength', { corridorLength: { min: 3, max: 1 } }],
      ['branchChance', { branchChance: -1 }],
      ['layoutSymmetry', { layoutSymmetry: 'diagonal' }],
      ['layoutSymmetryChance', { layoutSymmetryChance: 2 }],
      ['corridorSymmetry', { corridorSymmetry: 'spiral' }],
      ['corridorSymmetryChance', { corridorSymmetryChance: -1 }],
    ])('rejects an invalid %s', (_name, options) => {
      // given
      const invalid = options;

      // when
      const generate = () => dungeon(invalid as Partial<DigDungeonOptions>);

      // then
      expect(generate).toThrow(RangeError);
    });
  });
});
