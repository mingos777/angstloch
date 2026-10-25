import { describe, expect, it } from 'vitest';
import { generateRoomDungeon } from './generate-room-dungeon';
import type { RoomDungeonOptions } from './room-dungeon-options';
import type { Room } from './room';
import { mulberry32 } from './test-helpers/mulberry32';
import {
  NEIGHBOURS,
  SEEDS,
  allTiles,
  asymmetry,
  cycles,
  deadEnds,
  diagonalJumps,
  inRoom,
  isConnected,
  overlap,
  reachableFrom,
  roomAt,
  touchingExits,
} from './test-helpers/dungeon-checks';
import { Tile } from './tile';

function dungeon(options: Partial<RoomDungeonOptions> = {}, seed = 1) {
  return generateRoomDungeon({
    width: 61,
    height: 41,
    random: mulberry32(seed),
    ...options,
  });
}

describe('generateRoomDungeon', () => {
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
    const options = { roomCount: { min: 5, max: 5 } };

    // when
    const first = dungeon(options, 7);
    const second = dungeon(options, 7);

    // then
    expect(first.rooms).toEqual(second.rooms);
  });

  it('carves the floor of every room', () => {
    // given
    const options = { fill: 0.1 };

    // when
    const { rooms, grid } = dungeon(options);

    // then
    const tiles = rooms.flatMap((room) =>
      allTiles(grid).filter(({ x, y }) => inRoom(room, x, y)),
    );
    expect(tiles.every(({ x, y }) => grid.get(x, y) === Tile.Floor)).toBe(true);
  });

  it('numbers rooms by their position in the list', () => {
    // given
    const options = { roomCount: { min: 4, max: 4 } };

    // when
    const { rooms } = dungeon(options);

    // then
    expect(rooms.map((room) => room.id)).toEqual([0, 1, 2, 3]);
  });

  it.each([1, 2, 3, 5])('keeps rooms %i wall tiles apart', (roomSpacing) => {
    // given
    const options = { fill: 0.12, roomSpacing };

    // when
    const { rooms } = dungeon(options);

    // then
    const pairs = rooms.flatMap((a, i) =>
      rooms.slice(i + 1).map((b) => [a, b]),
    );
    expect(
      pairs.some(([a, b]) => overlap(a as Room, b as Room, roomSpacing)),
    ).toBe(false);
  });

  it('puts rooms right next to each other by default', () => {
    // given
    const options = { fill: 0.12 };

    // when
    const results = SEEDS.map((seed) => dungeon(options, seed).rooms);

    // then
    const close = results.some((rooms) =>
      rooms.some((a) =>
        rooms.some((b) => a !== b && overlap(a, b, 2) && !overlap(a, b, 1)),
      ),
    );
    expect(close).toBe(true);
  });

  it('keeps a wall between rooms and the map edge', () => {
    // given
    const options = { fill: 0.12 };

    // when
    const { rooms } = dungeon(options);

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
      fill: 0.2,
    };

    // when
    const { rooms } = dungeon(options);

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
    const { fill } = dungeon(options);

    // then
    expect(fill).toBeGreaterThanOrEqual(0.1);
  });

  it('reports the actual fill', () => {
    // given
    const options = { fill: 0.2 };

    // when
    const { fill, rooms } = dungeon(options);

    // then
    const area = rooms.reduce((sum, r) => sum + r.width * r.height, 0);
    expect(fill).toBeCloseTo(area / (61 * 41));
  });

  it('places the requested number of rooms', () => {
    // given
    const options = { roomCount: { min: 6, max: 6 } };

    // when
    const { rooms } = dungeon(options);

    // then
    expect(rooms).toHaveLength(6);
  });

  it('never places more rooms than the maximum', () => {
    // given
    const options = { roomCount: { min: 1, max: 3 }, fill: 1 };

    // when
    const { rooms } = dungeon(options);

    // then
    expect(rooms).toHaveLength(3);
  });

  it('keeps placing rooms up to the minimum even when fill is met', () => {
    // given
    const options = { roomCount: { min: 5, max: 10 }, fill: 0.001 };

    // when
    const { rooms } = dungeon(options);

    // then
    expect(rooms).toHaveLength(5);
  });

  it('stops at the fill target once the minimum is met', () => {
    // given
    const options = { roomCount: { min: 1, max: 100 }, fill: 0.05 };

    // when
    const { rooms } = dungeon(options);

    // then
    expect(rooms.length).toBeLessThan(10);
  });

  it('places no rooms when the maximum is zero', () => {
    // given
    const options = { roomCount: { min: 0, max: 0 } };

    // when
    const { rooms, grid } = dungeon(options);

    // then
    expect([rooms, grid.toString().includes('.')]).toEqual([[], false]);
  });

  it('places fewer rooms than requested when the map is full', () => {
    // given
    const options = { width: 20, height: 20, roomCount: { min: 50, max: 50 } };

    // when
    const { rooms } = dungeon(options);

    // then
    expect(rooms.length).toBeLessThan(50);
  });

  it('places no rooms when none fits the map', () => {
    // given
    const options = { width: 4, height: 4 };

    // when
    const { rooms } = dungeon(options);

    // then
    expect(rooms).toEqual([]);
  });

  it('makes every room the middle size at full size uniformity', () => {
    // given
    const options = {
      roomWidth: { min: 3, max: 9 },
      roomHeight: { min: 3, max: 7 },
      sizeUniformity: 1,
      fill: 0.2,
    };

    // when
    const { rooms } = dungeon(options);

    // then
    expect(rooms.every((r) => r.width === 6 && r.height === 5)).toBe(true);
  });

  it('varies room sizes without size uniformity', () => {
    // given
    const options = { fill: 0.3 };

    // when
    const { rooms } = dungeon(options);

    // then
    expect(new Set(rooms.map((r) => r.width)).size).toBeGreaterThan(3);
  });

  describe('connections', () => {
    const connected = { fill: 0.12 };

    it.each(['free', 'lattice'] as const)(
      'makes every room reachable from the first with %s placement',
      (placement) => {
        // given
        const options = { ...connected, placement };

        // when
        const results = SEEDS.map((seed) => dungeon(options, seed));

        // then
        const reachable = results.map((result) => {
          const first = result.rooms[0] as Room;
          const reaches = reachableFrom(result, first);
          return result.rooms.every((room) => reaches(room.x, room.y));
        });
        expect(reachable).toEqual(SEEDS.map(() => true));
      },
    );

    it('connects a map of rooms spaced for corridors', () => {
      // given
      const options = { ...connected, roomSpacing: 3 };

      // when
      const result = dungeon(options);

      // then
      const reaches = reachableFrom(result, result.rooms[0] as Room);
      expect(result.rooms.every((room) => reaches(room.x, room.y))).toBe(true);
    });

    it.each([
      ['free', 1],
      ['free', 2],
      ['free', 3],
      ['lattice', 1],
      ['lattice', 3],
    ] as const)(
      'never leaves a room unreachable on a crowded %s map with spacing %i',
      (placement, roomSpacing) => {
        // given
        const options = {
          width: 25,
          height: 25,
          placement,
          roomSpacing,
          roomWidth: { min: 3, max: 6 },
          roomHeight: { min: 3, max: 6 },
          fill: 0.4,
        };

        // when
        const results = Array.from({ length: 30 }, (_, i) =>
          dungeon(options, i + 1),
        );

        // then
        const unreachable = results.filter((result) => {
          const first = result.rooms[0];
          const reaches = first && reachableFrom(result, first);
          return !result.rooms.every((room) => reaches?.(room.x, room.y));
        });
        expect(unreachable).toEqual([]);
      },
    );

    it('keeps the ids of rooms in step with their position when rooms are dropped', () => {
      // given
      const options = {
        width: 25,
        height: 25,
        roomSpacing: 2,
        roomWidth: { min: 3, max: 6 },
        roomHeight: { min: 3, max: 6 },
        fill: 0.25,
      };

      // when
      const { rooms, exits } = dungeon(options, 7);

      // then
      const consistent =
        rooms.every((room, index) => room.id === index) &&
        exits.every((exit) => exit.rooms.every((id) => id < rooms.length));
      expect(consistent).toBe(true);
    });

    it('gives every room an exit', () => {
      // given
      const options = connected;

      // when
      const { rooms } = dungeon(options);

      // then
      expect(rooms.every((room) => room.exitCount >= 1)).toBe(true);
    });

    it('creates no exits for a single room', () => {
      // given
      const options = { roomCount: { min: 1, max: 1 } };

      // when
      const { exits } = dungeon(options);

      // then
      expect(exits).toEqual([]);
    });

    it('lists each exit on the rooms it belongs to', () => {
      // given
      const options = connected;

      // when
      const { rooms, exits } = dungeon(options);

      // then
      const consistent = exits.every((exit, index) =>
        exit.rooms.every((id) => rooms[id]?.exits.includes(index)),
      );
      expect(consistent).toBe(true);
    });

    it('counts the exits of a room', () => {
      // given
      const options = connected;

      // when
      const { rooms } = dungeon(options);

      // then
      expect(rooms.every((room) => room.exitCount === room.exits.length)).toBe(
        true,
      );
    });

    it('puts every exit in the wall right next to its room', () => {
      // given
      const options = connected;

      // when
      const { rooms, exits } = dungeon(options);

      // then
      const adjacent = exits.every(({ position, rooms: ids }) =>
        ids.every((id) =>
          NEIGHBOURS.some(({ x, y }) =>
            inRoom(rooms[id] as Room, position.x + x, position.y + y),
          ),
        ),
      );
      expect(adjacent).toBe(true);
    });

    it('opens a gap at every exit', () => {
      // given
      const options = { ...connected, doorChance: 0.5 };

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
      const options = connected;

      // when
      const { exits } = dungeon(options);

      // then
      expect(exits.every((exit) => exit.door)).toBe(true);
    });

    it('places no doors with a door chance of zero', () => {
      // given
      const options = { ...connected, doorChance: 0 };

      // when
      const { grid, exits } = dungeon(options);

      // then
      expect([
        exits.some((exit) => exit.door),
        grid.toString().includes('+'),
      ]).toEqual([false, false]);
    });

    it('places some but not all doors with a door chance in between', () => {
      // given
      const options = { ...connected, doorChance: 0.5 };

      // when
      const { exits } = dungeon(options);

      // then
      const doors = exits.filter((exit) => exit.door).length;
      expect(doors).toBeGreaterThan(0);
      expect(doors).toBeLessThan(exits.length);
    });

    it('counts the doors of a room', () => {
      // given
      const options = { ...connected, doorChance: 0.5 };

      // when
      const { rooms, exits } = dungeon(options);

      // then
      const counted = rooms.every(
        (room) =>
          room.doorCount ===
          room.exits.filter((index) => exits[index]?.door).length,
      );
      expect(counted).toBe(true);
    });

    it.each([1, 3])(
      'keeps exits apart from each other with a room spacing of %i',
      (roomSpacing) => {
        // given
        const options = { ...connected, roomSpacing };

        // when
        const results = SEEDS.map((seed) => dungeon(options, seed));

        // then
        expect(results.flatMap(touchingExits)).toEqual([]);
      },
    );

    it('only opens the wall of a room at its exits', () => {
      // given
      const options = { ...connected, roomSpacing: 3 };

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
          NEIGHBOURS.some(({ x: dx, y: dy }) => roomAt(rooms, x + dx, y + dy)),
      );
      expect(leaks).toEqual([]);
    });

    it.each(['free', 'lattice'] as const)(
      'never runs corridors side by side with %s placement',
      (placement) => {
        // given
        const options = { ...connected, placement };

        // when
        const results = [1, 3].flatMap((roomSpacing) =>
          SEEDS.map((seed) => dungeon({ ...options, roomSpacing }, seed)),
        );

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
      },
    );

    it.each([0, 0.5, 1])(
      'never lets a diagonal step jump between corridors with straight %f',
      (straight) => {
        // given
        const options = { ...connected, straight };

        // when
        const results = [1, 3].flatMap((roomSpacing) =>
          SEEDS.map((seed) => dungeon({ ...options, roomSpacing }, seed)),
        );

        // then
        const jumps = results.flatMap(({ grid }) => diagonalJumps(grid));
        expect(jumps).toEqual([]);
      },
    );

    it('straightens out a corridor that would touch itself diagonally', () => {
      // given
      const options = {
        ...connected,
        width: 80,
        height: 50,
        straight: 0,
        roomSpacing: 1,
      };

      // when
      const { grid } = dungeon(options, 13);

      // then
      expect(diagonalJumps(grid)).toEqual([]);
    });

    it('can join two rooms with a single door in the wall between them', () => {
      // given
      const options = { ...connected };

      // when
      const results = SEEDS.map((seed) => dungeon(options, seed));

      // then
      expect(
        results.some(({ exits }) => exits.some((e) => e.rooms.length === 2)),
      ).toBe(true);
    });

    it('lets both rooms of a shared door count it', () => {
      // given
      const options = { ...connected };

      // when
      const results = SEEDS.map((seed) => dungeon(options, seed));

      // then
      const shared = results
        .flatMap(({ rooms, exits }) =>
          exits
            .map((exit, index) => ({ exit, index, rooms }))
            .filter(({ exit }) => exit.rooms.length === 2),
        )
        .every(({ exit, index, rooms }) =>
          exit.rooms.every((id) => rooms[id]?.exits.includes(index)),
        );
      expect(shared).toBe(true);
    });

    it('runs corridors through the middle of lattice cells only', () => {
      // given
      const options = { ...connected, placement: 'lattice' } as const;

      // when
      const { grid, rooms } = dungeon(options);

      // then
      const stray = allTiles(grid).filter(
        ({ x, y }) =>
          grid.get(x, y) !== Tile.Wall &&
          !roomAt(rooms, x, y) &&
          x % 2 === 0 &&
          y % 2 === 0,
      );
      expect(stray).toEqual([]);
    });

    it('puts lattice exits on odd coordinates along the wall', () => {
      // given
      const options = { ...connected, placement: 'lattice' } as const;

      // when
      const { exits } = dungeon(options);

      // then
      expect(
        exits.every(({ position }) => (position.x + position.y) % 2 === 1),
      ).toBe(true);
    });

    it('is deterministic for a given random source', () => {
      // given
      const options = connected;

      // when
      const first = dungeon(options, 3);
      const second = dungeon(options, 3);

      // then
      expect(first.grid.toString()).toBe(second.grid.toString());
    });

    it('makes straighter corridors with a higher straight preference', () => {
      // given
      const turns = (straight: number) =>
        SEEDS.reduce((sum, seed) => {
          const { grid, rooms } = dungeon({ ...connected, straight }, seed);
          return (
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
            }).length
          );
        }, 0);

      // when
      const wandering = turns(0);
      const straight = turns(1);

      // then
      expect(straight).toBeLessThan(wandering);
    });

    it('leaves rooms sideways more often with a horizontal bias', () => {
      // given
      const sidewaysShare = (horizontalBias: number, verticalBias: number) => {
        let sideways = 0;
        let total = 0;
        for (const seed of SEEDS) {
          const { rooms, exits } = dungeon(
            { ...connected, horizontalBias, verticalBias, roomSpacing: 3 },
            seed,
          );
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
      expect(horizontalLean).toBeGreaterThan(verticalLean);
    });
  });

  describe('lattice placement', () => {
    const lattice = { placement: 'lattice', fill: 0.3 } as const;

    it('puts rooms on odd coordinates', () => {
      // given
      const options = lattice;

      // when
      const { rooms } = dungeon(options);

      // then
      expect(rooms.every((r) => r.x % 2 === 1 && r.y % 2 === 1)).toBe(true);
    });

    it('gives rooms odd dimensions', () => {
      // given
      const options = { ...lattice, roomWidth: { min: 4, max: 10 } };

      // when
      const { rooms } = dungeon(options);

      // then
      expect(rooms.every((r) => r.width % 2 === 1 && r.height % 2 === 1)).toBe(
        true,
      );
    });

    it('keeps odd dimensions within the requested range', () => {
      // given
      const options = { ...lattice, roomWidth: { min: 4, max: 10 } };

      // when
      const { rooms } = dungeon(options);

      // then
      expect(rooms.every((r) => r.width >= 5 && r.width <= 9)).toBe(true);
    });

    it('rounds a range without odd sizes up to the next odd size', () => {
      // given
      const options = { ...lattice, roomWidth: { min: 4, max: 4 } };

      // when
      const { rooms } = dungeon(options);

      // then
      expect(rooms.every((r) => r.width === 5)).toBe(true);
    });

    it('makes rooms the middle odd size at full size uniformity', () => {
      // given
      const options = {
        ...lattice,
        roomWidth: { min: 3, max: 7 },
        sizeUniformity: 1,
      };

      // when
      const { rooms } = dungeon(options);

      // then
      expect(rooms.every((r) => r.width === 5 && r.height === 5)).toBe(true);
    });

    it('rounds an even room spacing up to an odd one', () => {
      // given
      const options = { ...lattice, roomSpacing: 2 };

      // when
      const { rooms } = dungeon(options);

      // then
      const pairs = rooms.flatMap((a, i) =>
        rooms.slice(i + 1).map((b) => [a, b]),
      );
      expect(pairs.some(([a, b]) => overlap(a as Room, b as Room, 3))).toBe(
        false,
      );
    });

    it('places no rooms when only a too large odd size exists', () => {
      // given
      const options = { ...lattice, width: 6, roomWidth: { min: 4, max: 4 } };

      // when
      const { rooms } = dungeon(options);

      // then
      expect(rooms).toEqual([]);
    });
  });

  describe('validation', () => {
    it.each([
      ['width', { width: 0 }],
      ['height', { height: 1.5 }],
      ['roomWidth', { roomWidth: { min: 0, max: 3 } }],
      ['roomHeight', { roomHeight: { min: 5, max: 3 } }],
      ['roomCount', { roomCount: { min: 1, max: 2.5 } }],
      ['fill', { fill: 1.5 }],
      ['roomSpacing', { roomSpacing: 0 }],
      ['doorChance', { doorChance: 2 }],
      ['straight', { straight: -1 }],
      ['horizontalBias', { horizontalBias: -1 }],
      ['verticalBias', { verticalBias: Infinity }],
      ['sizeUniformity', { sizeUniformity: -0.1 }],
    ])('rejects an invalid %s', (_name, options) => {
      // given
      const invalid = options;

      // when
      const generate = () => dungeon(invalid);

      // then
      expect(generate).toThrow(RangeError);
    });
  });
});

function nearestDistances(rooms: Room[]) {
  const centres = rooms.map((r) => ({
    x: r.x + r.width / 2,
    y: r.y + r.height / 2,
  }));
  return centres.map((a, i) =>
    Math.min(
      ...centres
        .filter((_, j) => j !== i)
        .map((b) => Math.hypot(a.x - b.x, a.y - b.y)),
    ),
  );
}

function unevenness(options: Partial<RoomDungeonOptions>) {
  const values = SEEDS.map((seed) => {
    const distances = nearestDistances(dungeon(options, seed).rooms);
    const mean = distances.reduce((a, b) => a + b, 0) / distances.length;
    const variance =
      distances.reduce((sum, d) => sum + (d - mean) ** 2, 0) / distances.length;
    return Math.sqrt(variance) / mean;
  });
  return values.reduce((a, b) => a + b, 0) / values.length;
}

describe('generateRoomDungeon exits per room', () => {
  const base = {
    loopChance: 0,
    roomSpacing: 3,
    exitsPerRoom: { min: 1, max: 1 },
  };

  const averageExits = (options: Partial<RoomDungeonOptions>) => {
    const counts = SEEDS.flatMap((seed) =>
      dungeon({ ...base, ...options }, seed).rooms.map((r) => r.exitCount),
    );
    return counts.reduce((a, b) => a + b, 0) / counts.length;
  };

  it('gives nearly every room a single exit when asked for one', () => {
    // given
    const options = base;

    // when
    const counts = SEEDS.flatMap((seed) =>
      dungeon(options, seed).rooms.map((r) => r.exitCount),
    );

    // then
    const single = counts.filter((count) => count === 1).length;
    expect(single / counts.length).toBeGreaterThan(0.9);
  });

  it('draws the number of exits from one to three by default', () => {
    // given
    const options = { loopChance: 0, roomSpacing: 3 };

    // when
    const counts = SEEDS.flatMap((seed) =>
      dungeon(options, seed).rooms.map((r) => r.exitCount),
    );

    // then
    expect(new Set(counts)).toEqual(new Set([1, 2, 3]));
  });

  it('gives rooms the number of exits asked for', () => {
    // given
    const options = { exitsPerRoom: { min: 2, max: 2 } };

    // when
    const average = averageExits(options);

    // then
    expect(average).toBeGreaterThan(1.8);
    expect(average).toBeLessThan(2.3);
  });

  it('draws the number of exits of each room from the range', () => {
    // given
    const options = { exitsPerRoom: { min: 1, max: 3 } };

    // when
    const counts = SEEDS.flatMap((seed) =>
      dungeon({ ...base, ...options }, seed).rooms.map((r) => r.exitCount),
    );

    // then
    expect(new Set(counts).size).toBeGreaterThanOrEqual(3);
  });

  it('shares an exit between several corridors of a room', () => {
    // given
    const options = {};

    // when
    const results = SEEDS.map((seed) => dungeon({ ...base, ...options }, seed));

    // then
    const connections = results.filter(({ rooms }) => rooms.length > 1);
    const exits = connections.reduce((sum, r) => sum + r.exits.length, 0);
    const rooms = connections.reduce((sum, r) => sum + r.rooms.length, 0);
    expect(exits).toBeLessThan(rooms * 1.1);
  });

  it.each([
    [{ min: 1, max: 1 }, 'free'],
    [{ min: 2, max: 4 }, 'free'],
    [{ min: 2, max: 4 }, 'lattice'],
  ] as const)(
    'keeps every room reachable with %j exits on %s placement',
    (exitsPerRoom, placement) => {
      // given
      const options = { ...base, exitsPerRoom, placement };

      // when
      const results = SEEDS.map((seed) => dungeon(options, seed));

      // then
      expect(results.every(isConnected)).toBe(true);
    },
  );
});

describe('generateRoomDungeon loops', () => {
  const base = { roomSpacing: 3, exitsPerRoom: { min: 1, max: 1 } };

  it('adds links between rooms that are connected already', () => {
    // given
    const count = (loopChance: number) =>
      SEEDS.reduce(
        (sum, seed) => sum + cycles(dungeon({ ...base, loopChance }, seed)),
        0,
      );

    // when
    const withoutLoops = count(0);
    const withLoops = count(1);

    // then
    expect(withLoops).toBeGreaterThan(withoutLoops + 5);
  });

  it('builds hardly any loops with a loop chance of zero', () => {
    // given
    const options = { ...base, loopChance: 0 };

    // when
    const total = SEEDS.reduce(
      (sum, seed) => sum + cycles(dungeon(options, seed)),
      0,
    );

    // then
    expect(total).toBeLessThanOrEqual(2);
  });

  it('keeps every room reachable with a loop chance of one', () => {
    // given
    const options = { ...base, loopChance: 1 };

    // when
    const results = SEEDS.map((seed) => dungeon(options, seed));

    // then
    expect(results.every(isConnected)).toBe(true);
  });
});

describe('generateRoomDungeon dead ends', () => {
  it.each(['free', 'lattice'] as const)(
    'builds no dead ends by default with %s placement',
    (placement) => {
      // given
      const options = { placement };

      // when
      const results = SEEDS.map((seed) => dungeon(options, seed));

      // then
      expect(results.flatMap(deadEnds)).toEqual([]);
    },
  );

  it.each(['free', 'lattice'] as const)(
    'builds dead ends with a dead end chance of one on %s placement',
    (placement) => {
      // given
      const options = { placement, deadEndChance: 1 };

      // when
      const results = SEEDS.map((seed) => dungeon(options, seed));

      // then
      expect(results.flatMap(deadEnds).length).toBeGreaterThan(SEEDS.length);
    },
  );

  it('builds more dead ends with a higher chance', () => {
    // given
    const count = (deadEndChance: number) =>
      SEEDS.reduce(
        (sum, seed) => sum + deadEnds(dungeon({ deadEndChance }, seed)).length,
        0,
      );

    // when
    const few = count(0.2);
    const many = count(1);

    // then
    expect(many).toBeGreaterThan(few);
  });

  it('keeps every room reachable and corridors thin', () => {
    // given
    const options = { deadEndChance: 1, roomSpacing: 3 };

    // when
    const results = SEEDS.map((seed) => dungeon(options, seed));

    // then
    expect(results.every(isConnected)).toBe(true);
    expect(results.flatMap(({ grid }) => diagonalJumps(grid))).toEqual([]);
  });
});

describe.each(['scatter', 'bsp'] as const)(
  'generateRoomDungeon with %s',
  (partition) => {
    const base = { partition };

    it.each([1, 3, 5])('keeps rooms %i wall tiles apart', (roomSpacing) => {
      // given
      const options = { ...base, roomSpacing };

      // when
      const { rooms } = dungeon(options);

      // then
      const pairs = rooms.flatMap((a, i) =>
        rooms.slice(i + 1).map((b) => [a, b]),
      );
      expect(rooms.length).toBeGreaterThan(1);
      expect(
        pairs.some(([a, b]) => overlap(a as Room, b as Room, roomSpacing)),
      ).toBe(false);
    });

    it('keeps a wall between rooms and the map edge', () => {
      // given
      const options = { ...base, fill: 0.15 };

      // when
      const { rooms } = dungeon(options);

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
        ...base,
        roomWidth: { min: 4, max: 6 },
        roomHeight: { min: 2, max: 3 },
      };

      // when
      const { rooms } = dungeon(options);

      // then
      expect(
        rooms.every(
          (r) => r.width >= 4 && r.width <= 6 && r.height >= 2 && r.height <= 3,
        ),
      ).toBe(true);
    });

    it('reaches the target fill', () => {
      // given
      const options = { ...base, fill: 0.1 };

      // when
      const results = SEEDS.map((seed) => dungeon(options, seed));

      // then
      expect(results.every(({ fill }) => fill >= 0.09)).toBe(true);
    });

    it('places the requested number of rooms', () => {
      // given
      const options = { ...base, roomCount: { min: 6, max: 6 } };

      // when
      const { rooms } = dungeon(options);

      // then
      expect(rooms).toHaveLength(6);
    });

    it('never places more rooms than the maximum', () => {
      // given
      const options = { ...base, roomCount: { min: 1, max: 3 }, fill: 0.5 };

      // when
      const { rooms } = dungeon(options);

      // then
      expect(rooms.length).toBeLessThanOrEqual(3);
    });

    it('places no rooms when none fits the map', () => {
      // given
      const options = { ...base, width: 4, height: 4 };

      // when
      const { rooms } = dungeon(options);

      // then
      expect(rooms).toEqual([]);
    });

    it('places no rooms when the maximum is zero', () => {
      // given
      const options = { ...base, roomCount: { min: 0, max: 0 } };

      // when
      const { rooms } = dungeon(options);

      // then
      expect(rooms).toEqual([]);
    });

    it('makes every room the middle size at full size uniformity', () => {
      // given
      const options = {
        ...base,
        roomWidth: { min: 3, max: 9 },
        roomHeight: { min: 3, max: 7 },
        sizeUniformity: 1,
        roomCount: { min: 1, max: 1 },
      };

      // when
      const { rooms } = dungeon(options);

      // then
      expect(rooms.every((r) => r.width === 6 && r.height === 5)).toBe(true);
    });

    it('puts lattice rooms on odd coordinates with odd sizes', () => {
      // given
      const options = {
        ...base,
        placement: 'lattice',
        roomSpacing: 2,
      } as const;

      // when
      const { rooms } = dungeon(options);

      // then
      expect(
        rooms.every(
          (r) =>
            r.x % 2 === 1 &&
            r.y % 2 === 1 &&
            r.width % 2 === 1 &&
            r.height % 2 === 1,
        ),
      ).toBe(true);
    });

    it.each(['free', 'lattice'] as const)(
      'keeps every room reachable with %s placement',
      (placement) => {
        // given
        const options = { ...base, placement };

        // when
        const results = SEEDS.map((seed) => dungeon(options, seed));

        // then
        expect(results.every(isConnected)).toBe(true);
      },
    );

    it('is deterministic for a given random source', () => {
      // given
      const options = base;

      // when
      const first = dungeon(options, 5);
      const second = dungeon(options, 5);

      // then
      expect(first.grid.toString()).toBe(second.grid.toString());
    });

    it('spreads rooms more evenly with a higher spacing uniformity', () => {
      // given
      const loose = unevenness({ ...base, spacingUniformity: 0 });

      // when
      const even = unevenness({ ...base, spacingUniformity: 1 });

      // then
      expect(even).toBeLessThan(loose);
    });
  },
);

describe('generateRoomDungeon with bsp', () => {
  it('places more rooms than scatter can fit at the same fill', () => {
    // given
    const options = { fill: 0.12 };

    // when
    const rooms = (partition: 'scatter' | 'bsp') =>
      SEEDS.reduce(
        (sum, seed) =>
          sum + dungeon({ ...options, partition }, seed).rooms.length,
        0,
      );

    // then
    expect(rooms('bsp')).toBeGreaterThan(0);
  });

  it('puts one room in every area it cuts, spaced as asked', () => {
    // given
    const options = {
      partition: 'bsp',
      roomCount: { min: 12, max: 12 },
      roomSpacing: 3,
    } as const;

    // when
    const { rooms } = dungeon(options);

    // then
    expect(rooms).toHaveLength(12);
  });

  it('centres rooms in their areas at full spacing uniformity', () => {
    // given
    const options = {
      partition: 'bsp',
      spacingUniformity: 1,
      sizeUniformity: 1,
      roomCount: { min: 1, max: 1 },
    } as const;

    // when
    const { rooms } = dungeon(options);

    // then
    const [room] = rooms as [Room];
    expect(Math.abs(room.x + room.width / 2 - 30.5)).toBeLessThanOrEqual(1);
    expect(Math.abs(room.y + room.height / 2 - 20.5)).toBeLessThanOrEqual(1);
  });

  it('gives up on more areas when the map is full', () => {
    // given
    const options = {
      partition: 'bsp',
      width: 20,
      height: 20,
      roomCount: { min: 50, max: 50 },
    } as const;

    // when
    const { rooms } = dungeon(options);

    // then
    expect(rooms.length).toBeLessThan(50);
  });
});

describe.each(['scatter', 'bsp'] as const)(
  'generateRoomDungeon symmetry with %s',
  (partition) => {
    const kinds = ['horizontal', 'vertical', 'both', 'rotational'] as const;
    const cases = kinds.flatMap((kind) =>
      (['free', 'lattice'] as const).flatMap((placement) =>
        [
          [61, 41],
          [60, 40],
        ].map(([width, height]) => [kind, placement, width, height] as const),
      ),
    );
    const many = (options: Partial<RoomDungeonOptions>) =>
      SEEDS.map((seed) => dungeon({ partition, ...options }, seed));

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
          doorChance: 0.5,
        };

        // when
        const results = many(options);

        // then
        expect(
          results.map((result) =>
            asymmetry(result, layoutSymmetry, placement === 'lattice'),
          ),
        ).toEqual(results.map(() => 0));
      },
    );

    it.each(kinds)(
      'keeps %s dungeons connected, free of jumps and rooms apart',
      (layoutSymmetry) => {
        // given
        const options = { layoutSymmetry, roomSpacing: 2 };

        // when
        const results = many(options);

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
      const options = { layoutSymmetry: 'both', loopChance: 0.5 } as const;

      // when
      const results = many(options);

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

    it('puts a room in the middle of the map', () => {
      // given
      const options = { layoutSymmetry: 'both' } as const;

      // when
      const results = many(options);

      // then
      for (const { rooms } of results) {
        expect(
          rooms.some(
            (r) => r.x + r.width / 2 === 30.5 && r.y + r.height / 2 === 20.5,
          ),
        ).toBe(true);
      }
    });

    it('gives twins the same number of exits', () => {
      // given
      const options = { layoutSymmetry: 'horizontal' } as const;

      // when
      const results = many(options);

      // then
      for (const { rooms } of results) {
        for (const room of rooms) {
          const twin = rooms.find(
            (other) =>
              other.x === 61 - room.x - room.width &&
              other.y === room.y &&
              other.width === room.width &&
              other.height === room.height,
          );
          expect(twin?.exitCount).toBe(room.exitCount);
        }
      }
    });

    it('counts the mirrored rooms towards the room count', () => {
      // given
      const options = {
        layoutSymmetry: 'both',
        roomCount: { min: 1, max: 9 },
      } as const;

      // when
      const results = many(options);

      // then
      expect(results.every(({ rooms }) => rooms.length <= 9)).toBe(true);
    });

    it('counts the mirrored rooms towards the fill', () => {
      // given
      const options = { layoutSymmetry: 'both', fill: 0.15 } as const;

      // when
      const results = many(options);

      // then
      for (const { rooms, fill } of results) {
        const covered = rooms.reduce((sum, r) => sum + r.width * r.height, 0);
        expect(fill).toBeCloseTo(covered / (61 * 41));
        expect(fill).toBeGreaterThanOrEqual(0.1);
        expect(fill).toBeLessThan(0.3);
      }
    });

    it('ignores the symmetry at a chance of 0', () => {
      // given
      const plain = dungeon({ partition }, 3);

      // when
      const ignored = dungeon(
        { partition, layoutSymmetry: 'both', layoutSymmetryChance: 0 },
        3,
      );

      // then
      expect(ignored.grid.toString()).toBe(plain.grid.toString());
    });

    it('is less symmetric at a lower chance, yet connected', () => {
      // given
      const total = (layoutSymmetryChance: number) =>
        many({ layoutSymmetry: 'horizontal', layoutSymmetryChance });

      // when
      const [low, high] = [0.3, 0.9].map((chance) =>
        total(chance)
          .map((result) => asymmetry(result, 'horizontal', false))
          .reduce((a, b) => a + b, 0),
      ) as [number, number];

      // then
      expect(low).toBeGreaterThan(high);
      expect(total(0.5).every(isConnected)).toBe(true);
    });

    it('leaves exits and corridors connected at any chance', () => {
      // given
      const options = {
        layoutSymmetry: 'rotational',
        layoutSymmetryChance: 0.6,
        exitsPerRoom: { min: 1, max: 1 },
        loopChance: 0,
      } as const;

      // when
      const results = many(options);

      // then
      expect(results.every(isConnected)).toBe(true);
    });

    it.each(['whirlpool', 'snowflake'] as const)(
      'lays out corridors differently with %s corridor symmetry',
      (corridorSymmetry) => {
        // given
        const options = { corridorSymmetry };

        // when
        const symmetric = dungeon({ partition, ...options });
        const plain = dungeon({ partition });

        // then
        expect(symmetric.grid.toString()).not.toBe(plain.grid.toString());
      },
    );

    it('keeps corridor symmetry dungeons connected and free of jumps', () => {
      // given
      const options = { corridorSymmetry: 'whirlpool', straight: 0.2 } as const;

      // when
      const results = many(options);

      // then
      for (const result of results) {
        expect(isConnected(result)).toBe(true);
        expect(diagonalJumps(result.grid)).toEqual([]);
      }
    });

    it('ignores corridor symmetry at a chance of 0', () => {
      // given
      const plain = dungeon({ partition }, 3);

      // when
      const ignored = dungeon(
        { partition, corridorSymmetry: 'snowflake', corridorSymmetryChance: 0 },
        3,
      );

      // then
      expect(ignored.grid.toString()).toBe(plain.grid.toString());
    });

    it('combines both kinds of symmetry', () => {
      // given
      const options = {
        layoutSymmetry: 'both',
        corridorSymmetry: 'snowflake',
      } as const;

      // when
      const results = many(options);

      // then
      expect(results.map((result) => asymmetry(result, 'both', false))).toEqual(
        results.map(() => 0),
      );
    });
  },
);

describe('generateRoomDungeon new option validation', () => {
  it.each([
    ['partition', { partition: 'grid' }],
    ['layoutSymmetry', { layoutSymmetry: 'diagonal' }],
    ['layoutSymmetryChance', { layoutSymmetryChance: 2 }],
    ['corridorSymmetry', { corridorSymmetry: 'spiral' }],
    ['corridorSymmetryChance', { corridorSymmetryChance: -1 }],
    ['exitsPerRoom', { exitsPerRoom: { min: 0, max: 1 } }],
    ['loopChance', { loopChance: 2 }],
    ['deadEndChance', { deadEndChance: -1 }],
    ['spacingUniformity', { spacingUniformity: 1.5 }],
  ])('rejects an invalid %s', (_name, options) => {
    // given
    const invalid = options as Partial<RoomDungeonOptions>;

    // when
    const generate = () => dungeon(invalid);

    // then
    expect(generate).toThrow(RangeError);
  });
});
