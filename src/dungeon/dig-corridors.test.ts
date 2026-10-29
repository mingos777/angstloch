import { describe, expect, it } from 'vitest';
import type { Area } from '../core/area';
import type { Grid } from '../core/grid';
import type { LayoutSymmetry } from '../core/layout-symmetry';
import { Tile } from '../core/tile';
import { emptyMap } from '../pipeline/empty-map';
import type { MapState } from '../pipeline/map-state';
import { pipeline } from '../pipeline/pipeline';
import { Reserve } from '../pipeline/reserve';
import { reserveTile } from '../pipeline/reserve-tile';
import { step } from '../pipeline/step';
import { carveRoom } from '../rooms/carve-room';
import { createRoomShape } from '../rooms/create-room-shape';
import type { Exit } from '../rooms/exit';
import { reserveRoomShape } from '../rooms/reserve-room-shape';
import type { Room } from '../rooms/room';
import type { RoomShape } from '../rooms/room-shape';
import { findTemplateExits } from '../rooms/templates/find-template-exits';
import { TemplateCell } from '../rooms/templates/template-cell';
import { TemplatePlacementError } from '../rooms/templates/template-placement-error';
import {
  NEIGHBORS,
  SEEDS,
  allTiles,
  asymmetry,
  cycles,
  deadEnds,
  diagonalJumps,
  inRoom,
  isConnected,
  overlap,
  reachable,
  roomAt,
  touchingExits,
} from '../test-helpers/dungeon-checks';
import { floorBeyondEntrances } from '../test-helpers/floor-beyond-entrances';
import { mulberry32 } from '../test-helpers/mulberry32';
import { digCorridors } from './dig-corridors';
import type { DigCorridorsOptions } from './dig-corridors-options';
import { joinRooms } from './join-rooms';
import { placePartitionedRooms } from './place-partitioned-rooms';
import { placeCellBlocks } from '../rooms/place-cell-blocks';
import { resolveCorridorSettings } from './resolve-corridor-settings';
import { placeScatteredRooms } from './place-scattered-rooms';
import type { PlaceScatteredRoomsOptions } from './place-scattered-rooms-options';

const { Floor: F, Wall: W, Exit: E } = TemplateCell;

/** Scattered rooms joined by corridors, with `roomExits` as `exits`, the shape the dungeon checks read. */
function dungeon(
  rooms: PlaceScatteredRoomsOptions = {},
  corridors: DigCorridorsOptions = {},
  seed = 1,
  width = 61,
  height = 41,
) {
  const result = pipeline(
    emptyMap({ width, height, tile: Tile.Wall }),
    [placeScatteredRooms(rooms), digCorridors(corridors)],
    { random: mulberry32(seed) },
  );
  return { ...result, exits: result.roomExits, fill: 0 };
}

/** The same options for both steps, as a symmetric map passes them. */
function both(options: PlaceScatteredRoomsOptions & DigCorridorsOptions) {
  return [options, options] as const;
}

/** A step that carves ordinary rooms at fixed spots, as a placement step would. */
function handRooms(floors: Area[], extras: { roomExits?: Exit[] } = {}) {
  return step(
    'handRooms',
    { adds: ['rooms', 'roomShapes'] },
    (state: MapState) => {
      const rooms = floors.map((floor, id): Room => ({
        ...floor,
        id,
        kind: 'room',
        exits: [],
        exitCount: 0,
        doorCount: 0,
      }));
      const roomShapes = rooms.map((room): RoomShape => {
        carveRoom(state.grid, room);
        const shape = { ...createRoomShape(room), doors: [] };
        reserveRoomShape(state, shape);
        return shape;
      });
      return { rooms, roomShapes, ...extras };
    },
  );
}

/** A closet at (x, y), as a templated room, with its fixed exit in the top wall. */
function closetRoom(id: number, x: number, y: number) {
  const cells = [
    [W, E, W],
    [W, F, W],
    [W, W, W],
  ];
  const shape: RoomShape = {
    x,
    y,
    width: 3,
    height: 3,
    cells,
    exits: findTemplateExits(cells),
    rotation: 0,
    mirrored: false,
    doors: [{ x: x + 1, y, door: true }],
  };
  const room: Room = {
    id,
    kind: 'room',
    x,
    y,
    width: 3,
    height: 3,
    exits: [],
    exitCount: 0,
    doorCount: 0,
    template: 0,
    rotation: 0,
    mirrored: false,
  };
  return { room, shape };
}

/** A step that adds two ordinary rooms and a closet at (30, 20), whose exit is walled in when `sealed` says so. */
function withCloset(sealed: () => boolean) {
  return step(
    'withCloset',
    { adds: ['rooms', 'roomShapes'] },
    (state: MapState) => {
      const rooms = [
        { x: 5, y: 5, width: 4, height: 4 },
        { x: 45, y: 25, width: 4, height: 4 },
      ].map((floor, id): Room => ({
        ...floor,
        id,
        kind: 'room',
        exits: [],
        exitCount: 0,
        doorCount: 0,
      }));
      const roomShapes = rooms.map((room): RoomShape => {
        carveRoom(state.grid, room);
        return { ...createRoomShape(room), doors: [] };
      });
      const closet = closetRoom(2, 30, 20);
      state.grid.set(31, 21, Tile.Floor);
      rooms.push(closet.room);
      roomShapes.push(closet.shape);
      for (const shape of roomShapes) {
        reserveRoomShape(state, shape);
      }
      if (sealed()) {
        reserveTile(state, 31, 19, Reserve.Solid);
      }
      return { rooms, roomShapes };
    },
  );
}

/** The number of pieces that the tiles that are not wall make, joined along edges. */
function pieces(grid: Grid): number {
  const seen = new Uint8Array(grid.width * grid.height);
  let count = 0;
  for (const start of allTiles(grid)) {
    if (
      grid.get(start.x, start.y) === Tile.Wall ||
      seen[start.y * grid.width + start.x]
    ) {
      continue;
    }
    ++count;
    seen[start.y * grid.width + start.x] = 1;
    for (const queue = [start]; queue.length > 0;) {
      const { x, y } = queue.pop() as { x: number; y: number };
      for (const step of NEIGHBORS) {
        const [nx, ny] = [x + step.x, y + step.y];
        if (grid.get(nx, ny) !== Tile.Wall && !seen[ny * grid.width + nx]) {
          seen[ny * grid.width + nx] = 1;
          queue.push({ x: nx, y: ny });
        }
      }
    }
  }
  return count;
}

function wallMap(width = 61, height = 41) {
  return emptyMap({ width, height, tile: Tile.Wall });
}

describe('digCorridors', () => {
  describe('with a cell block', () => {
    /** A cell block, rooms round it and the corridors, on a wall map of 60 by 40. */
    function prison(options: DigCorridorsOptions = {}, seed = 1) {
      return pipeline(
        emptyMap({ width: 60, height: 40, tile: Tile.Wall }),
        [placeCellBlocks(), placeScatteredRooms(), digCorridors(options)],
        { random: mulberry32(seed) },
      );
    }

    it('joins the block and the rooms into one dungeon', () => {
      // given
      const results = SEEDS.map((seed) => prison({}, seed));

      // when
      const cut = results.filter(
        (result) =>
          !isConnected({ ...result, exits: result.roomExits, fill: 0 }),
      );

      // then
      expect(cut).toEqual([]);
    });

    it('opens the entrance with a door by the door chance', () => {
      // given
      const [always, never] = [prison(), prison({ doorChance: 0 })];

      // when
      const [door, gap] = [always, never].map(({ grid, roomGroups }) => {
        const { x, y } = roomGroups[0]?.entrance ?? { x: -1, y: -1 };
        return grid.get(x, y);
      });

      // then
      expect(door).toBe(Tile.Door);
      expect(gap).toBe(Tile.Floor);
    });

    it('opens the entrance through openReserved', () => {
      // given
      const { grid, reserved, roomGroups } = prison();

      // when
      const { x, y } = roomGroups[0]?.entrance ?? { x: -1, y: -1 };

      // then
      expect(reserved[y * grid.width + x]).toBe(Reserve.Solid);
    });

    it('opens an entrance that floor reaches right beyond it, with no corridor', () => {
      // given
      const base = emptyMap({ width: 60, height: 40, tile: Tile.Wall });
      const steps = [placeCellBlocks(), floorBeyondEntrances()] as const;
      const before = pipeline(base, steps, { random: mulberry32(1) }).grid;

      // when
      const { grid, roomGroups } = pipeline(base, [...steps, digCorridors()], {
        random: mulberry32(1),
      });

      // then
      const changed = [];
      for (let y = 0; y < grid.height; ++y) {
        for (let x = 0; x < grid.width; ++x) {
          if (grid.get(x, y) !== before.get(x, y)) {
            changed.push({ x, y, tile: grid.get(x, y) });
          }
        }
      }
      expect(changed).toEqual([
        { ...roomGroups[0]?.entrance, tile: Tile.Door },
      ]);
    });

    it('joins a block with a guard room and the rooms into one dungeon', () => {
      // given
      const make = (seed: number) =>
        pipeline(
          emptyMap({ width: 60, height: 40, tile: Tile.Wall }),
          [
            placeCellBlocks({ guardRoom: {} }),
            placeScatteredRooms(),
            digCorridors(),
          ],
          { random: mulberry32(seed) },
        );

      // when
      const cut = SEEDS.map(make).filter(
        (result) =>
          !isConnected({ ...result, exits: result.roomExits, fill: 0 }),
      );

      // then
      expect(cut).toEqual([]);
    });

    it('leaves the cells with the one door they have', () => {
      // given
      const { rooms, roomExits } = prison();

      // when
      const cells = rooms.filter(({ kind }) => kind === 'cell');

      // then
      expect(cells.length).toBeGreaterThan(0);
      for (const cell of cells) {
        expect(cell.exitCount).toBe(1);
        expect(roomExits[cell.exits[0] ?? -1]?.rooms).toEqual([cell.id]);
      }
    });
  });

  it('keeps the kind of every room it joins', () => {
    // given
    const base = emptyMap({ width: 61, height: 41, tile: Tile.Wall });

    // when
    const { rooms } = pipeline(base, [placeScatteredRooms(), digCorridors()], {
      random: mulberry32(1),
    });

    // then
    expect(rooms.length).toBeGreaterThan(1);
    expect(rooms.map(({ kind }) => kind)).toEqual(rooms.map(() => 'room'));
  });

  describe('joining', () => {
    it.each(['free', 'lattice'] as const)(
      'makes every room reachable from the first with %s placement',
      (placement) => {
        // given
        const [rooms, corridors] = both({ placement });

        // when
        const results = SEEDS.map((seed) => dungeon(rooms, corridors, seed));

        // then
        expect(results.map(isConnected)).toEqual(SEEDS.map(() => true));
      },
    );

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
        const rooms = {
          placement,
          roomSpacing,
          roomWidth: { min: 3, max: 6 },
          roomHeight: { min: 3, max: 6 },
          fill: 0.4,
        };

        // when
        const results = Array.from({ length: 30 }, (_, i) =>
          dungeon(rooms, { placement }, i + 1, 25, 25),
        );

        // then
        expect(results.filter((result) => !isConnected(result))).toEqual([]);
      },
    );

    it('joins the rooms of either placement step', () => {
      // given
      const steps = [
        placePartitionedRooms({ roomSpacing: 3 }),
        digCorridors(),
      ] as const;

      // when
      const result = pipeline(wallMap(), steps, { random: mulberry32(1) });

      // then
      expect(isConnected({ ...result, exits: result.roomExits, fill: 0 })).toBe(
        true,
      );
    });

    it.each(['bsp', 'bsp-random'] as const)(
      'joins every room with the %s connection',
      (connection) => {
        // given
        const corridors = { connection };

        // when
        const results = SEEDS.map((seed) => dungeon({}, corridors, seed));

        // then
        expect(results.every(isConnected)).toBe(true);
      },
    );

    it('adds hardly any loops of its own with the bsp connection, only where a corridor crosses another', () => {
      // given
      const corridors = {
        connection: 'bsp',
        loopChance: 0,
        exitsPerRoom: { min: 1, max: 1 },
      } as const;

      // when
      const results = SEEDS.map((seed) => dungeon({}, corridors, seed));

      // then
      for (const result of results) {
        expect(isConnected(result)).toBe(true);
        expect(cycles(result)).toBeLessThanOrEqual(1);
      }
    });

    it.each(
      (['bsp', 'bsp-random'] as const).flatMap((connection) =>
        (['horizontal', 'vertical', 'both', 'rotational'] as const).map(
          (symmetry) => [connection, symmetry] as const,
        ),
      ),
    )(
      'keeps the %s connection symmetric and joined with %s symmetry',
      (connection, symmetry) => {
        // given
        const [rooms, corridors] = both({ connection, symmetry });

        // when
        const results = SEEDS.map((seed) => dungeon(rooms, corridors, seed));

        // then
        for (const result of results) {
          expect(asymmetry(result, symmetry, false)).toBe(0);
          expect(isConnected(result)).toBe(true);
        }
      },
    );

    it.each(['bsp', 'bsp-random'] as const)(
      'joins lattice rooms and templated rooms with the %s connection',
      (connection) => {
        // given
        const closet = {
          cells: [
            [W, E, W],
            [W, F, W],
            [W, W, W],
          ],
        };

        // when
        const results = SEEDS.flatMap((seed) => [
          dungeon(
            { placement: 'lattice' },
            { connection, placement: 'lattice' },
            seed,
          ),
          dungeon({ templates: [closet] }, { connection }, seed),
        ]);

        // then
        expect(results.every(isConnected)).toBe(true);
      },
    );

    it('joins the rooms differently with the bsp connection', () => {
      // given
      const nearest = dungeon({ roomSpacing: 3 }, {}, 2);

      // when
      const bsp = dungeon({ roomSpacing: 3 }, { connection: 'bsp' }, 2);

      // then
      expect(bsp.grid.toString()).not.toBe(nearest.grid.toString());
    });

    it('is deterministic for a given random source', () => {
      // given
      const options = { roomSpacing: 3 };

      // when
      const first = dungeon(options, {}, 3);
      const second = dungeon(options, {}, 3);

      // then
      expect(first.grid.toString()).toBe(second.grid.toString());
    });

    it('creates no exits for a single room', () => {
      // given
      const rooms = { roomCount: { min: 1, max: 1 } };

      // when
      const { exits } = dungeon(rooms);

      // then
      expect(exits).toEqual([]);
    });
  });

  describe('exits', () => {
    it('gives every room an exit', () => {
      // given
      const rooms = { roomSpacing: 3 };

      // when
      const result = dungeon(rooms);

      // then
      expect(result.rooms.every((room) => room.exitCount >= 1)).toBe(true);
    });

    it('lists each exit on the rooms it belongs to, and counts them', () => {
      // given
      const corridors = { doorChance: 0.5 };

      // when
      const { rooms, exits } = dungeon({}, corridors);

      // then
      for (const room of rooms) {
        expect(room.exitCount).toBe(room.exits.length);
        expect(room.doorCount).toBe(
          room.exits.filter((index) => exits[index]?.door).length,
        );
      }
      expect(
        exits.every((exit, index) =>
          exit.rooms.every((id) => rooms[id]?.exits.includes(index)),
        ),
      ).toBe(true);
    });

    it('puts every exit in the wall right next to its rooms', () => {
      // given
      const rooms = { roomSpacing: 3 };

      // when
      const result = dungeon(rooms);

      // then
      const adjacent = result.exits.every(({ position, rooms: ids }) =>
        ids.every((id) =>
          NEIGHBORS.some(({ x, y }) =>
            inRoom(result.rooms[id] as Room, position.x + x, position.y + y),
          ),
        ),
      );
      expect(adjacent).toBe(true);
    });

    it('opens a gap at every exit, with a door where it says so', () => {
      // given
      const corridors = { doorChance: 0.5 };

      // when
      const { grid, exits } = dungeon({}, corridors);

      // then
      expect(
        exits.every(
          ({ position, door }) =>
            grid.get(position.x, position.y) ===
            (door ? Tile.Door : Tile.Floor),
        ),
      ).toBe(true);
      expect(exits.some((exit) => exit.door)).toBe(true);
      expect(exits.every((exit) => exit.door)).toBe(false);
    });

    it('places no doors with a door chance of zero', () => {
      // given
      const corridors = { doorChance: 0 };

      // when
      const { grid } = dungeon({}, corridors);

      // then
      expect(grid.toString()).not.toContain('+');
    });

    it.each([1, 3])(
      'keeps exits apart from each other with a room spacing of %i',
      (roomSpacing) => {
        // given
        const rooms = { roomSpacing };

        // when
        const results = SEEDS.map((seed) => dungeon(rooms, {}, seed));

        // then
        expect(results.flatMap(touchingExits)).toEqual([]);
      },
    );

    it('only opens the wall of a room at its exits', () => {
      // given
      const rooms = { roomSpacing: 3 };

      // when
      const { grid, rooms: placed, exits } = dungeon(rooms);

      // then
      const isExit = (x: number, y: number) =>
        exits.some(({ position }) => position.x === x && position.y === y);
      const leaks = allTiles(grid).filter(
        ({ x, y }) =>
          grid.get(x, y) !== Tile.Wall &&
          !roomAt(placed, x, y) &&
          !isExit(x, y) &&
          NEIGHBORS.some(({ x: dx, y: dy }) => roomAt(placed, x + dx, y + dy)),
      );
      expect(leaks).toEqual([]);
    });

    it('joins rooms that share a wall with a single door in it', () => {
      // given
      const rooms = { roomSpacing: 1 };

      // when
      const results = SEEDS.map((seed) => dungeon(rooms, {}, seed));

      // then
      const shared = results.flatMap(({ rooms: placed, exits }) =>
        exits
          .map((exit, index) => ({ exit, index }))
          .filter(({ exit }) => exit.rooms.length === 2)
          .map(({ exit, index }) =>
            exit.rooms.every((id) => placed[id]?.exits.includes(index)),
          ),
      );
      expect(shared.length).toBeGreaterThan(0);
      expect(shared.every(Boolean)).toBe(true);
    });

    it('gives nearly every room a single exit when asked for one', () => {
      // given
      const corridors = { loopChance: 0, exitsPerRoom: { min: 1, max: 1 } };

      // when
      const counts = SEEDS.flatMap((seed) =>
        dungeon({ roomSpacing: 3 }, corridors, seed).rooms.map(
          (room) => room.exitCount,
        ),
      );

      // then
      const single = counts.filter((count) => count === 1).length;
      expect(single / counts.length).toBeGreaterThan(0.9);
    });

    it('draws the number of exits of each room from one to three by default', () => {
      // given
      const corridors = { loopChance: 0 };

      // when
      const counts = SEEDS.flatMap((seed) =>
        dungeon({ roomSpacing: 3 }, corridors, seed).rooms.map(
          (room) => room.exitCount,
        ),
      );

      // then
      expect(new Set(counts)).toEqual(new Set([1, 2, 3]));
    });

    it('shares an exit between several corridors of a room', () => {
      // given
      const corridors = { loopChance: 0, exitsPerRoom: { min: 1, max: 1 } };

      // when
      const results = SEEDS.map((seed) =>
        dungeon({ roomSpacing: 3 }, corridors, seed),
      ).filter(({ rooms }) => rooms.length > 1);

      // then
      const exits = results.reduce((sum, r) => sum + r.exits.length, 0);
      const rooms = results.reduce((sum, r) => sum + r.rooms.length, 0);
      expect(exits).toBeLessThan(rooms * 1.1);
    });

    it('gives rooms about the number of exits asked for', () => {
      // given
      const corridors = { exitsPerRoom: { min: 2, max: 2 }, loopChance: 0 };

      // when
      const counts = SEEDS.flatMap((seed) =>
        dungeon({ roomSpacing: 3 }, corridors, seed).rooms.map(
          (room) => room.exitCount,
        ),
      );

      // then
      const average = counts.reduce((a, b) => a + b, 0) / counts.length;
      expect(average).toBeGreaterThan(1.8);
      expect(average).toBeLessThan(2.3);
    });
  });

  describe('corridors', () => {
    it.each(['free', 'lattice'] as const)(
      'never runs corridors side by side with %s placement',
      (placement) => {
        // given
        const results = [1, 3].flatMap((roomSpacing) =>
          SEEDS.map((seed) =>
            dungeon({ placement, roomSpacing }, { placement }, seed),
          ),
        );

        // when
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

        // then
        expect(wide).toEqual([]);
      },
    );

    it.each([0, 0.5, 1])(
      'never lets a diagonal step jump between corridors with straight %f',
      (straight) => {
        // given
        const corridors = { straight };

        // when
        const results = [1, 3].flatMap((roomSpacing) =>
          SEEDS.map((seed) => dungeon({ roomSpacing }, corridors, seed)),
        );

        // then
        expect(results.flatMap(({ grid }) => diagonalJumps(grid))).toEqual([]);
      },
    );

    it('runs lattice corridors through the middle of cells, with exits on odd coordinates', () => {
      // given
      const [rooms, corridors] = both({ placement: 'lattice' });

      // when
      const { grid, rooms: placed, exits } = dungeon(rooms, corridors);

      // then
      const stray = allTiles(grid).filter(
        ({ x, y }) =>
          grid.get(x, y) !== Tile.Wall &&
          !roomAt(placed, x, y) &&
          x % 2 === 0 &&
          y % 2 === 0,
      );
      expect(stray).toEqual([]);
      expect(
        exits.every(({ position }) => (position.x + position.y) % 2 === 1),
      ).toBe(true);
    });

    it('makes straighter corridors with a higher straight preference', () => {
      // given
      const turns = (straight: number) =>
        SEEDS.reduce((sum, seed) => {
          const { grid, rooms } = dungeon({}, { straight }, seed);
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
            { roomSpacing: 3 },
            { horizontalBias, verticalBias },
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

  describe('loops and dead ends', () => {
    const single = { roomSpacing: 3 };
    const one = { exitsPerRoom: { min: 1, max: 1 } };

    it('adds links between rooms that are joined already', () => {
      // given
      const count = (loopChance: number) =>
        SEEDS.reduce(
          (sum, seed) =>
            sum + cycles(dungeon(single, { ...one, loopChance }, seed)),
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
      const corridors = { ...one, loopChance: 0 };

      // when
      const total = SEEDS.reduce(
        (sum, seed) => sum + cycles(dungeon(single, corridors, seed)),
        0,
      );

      // then
      expect(total).toBeLessThanOrEqual(2);
    });

    it('keeps every room reachable with a loop chance of one', () => {
      // given
      const corridors = { ...one, loopChance: 1 };

      // when
      const results = SEEDS.map((seed) => dungeon(single, corridors, seed));

      // then
      expect(results.every(isConnected)).toBe(true);
    });

    it.each(['free', 'lattice'] as const)(
      'builds no dead ends by default and some at a chance of one with %s placement',
      (placement) => {
        // given
        const rooms = { placement };

        // when
        const plain = SEEDS.map((seed) => dungeon(rooms, { placement }, seed));
        const ends = SEEDS.map((seed) =>
          dungeon(rooms, { placement, deadEndChance: 1 }, seed),
        );

        // then
        expect(plain.flatMap(deadEnds)).toEqual([]);
        expect(ends.flatMap(deadEnds).length).toBeGreaterThan(SEEDS.length);
      },
    );

    it('builds more dead ends with a higher chance', () => {
      // given
      const count = (deadEndChance: number) =>
        SEEDS.reduce(
          (sum, seed) =>
            sum + deadEnds(dungeon({}, { deadEndChance }, seed)).length,
          0,
        );

      // when
      const few = count(0.2);
      const many = count(1);

      // then
      expect(many).toBeGreaterThan(few);
    });

    it('keeps every room reachable and corridors thin with dead ends', () => {
      // given
      const corridors = { deadEndChance: 1 };

      // when
      const results = SEEDS.map((seed) => dungeon(single, corridors, seed));

      // then
      expect(results.every(isConnected)).toBe(true);
      expect(results.flatMap(({ grid }) => diagonalJumps(grid))).toEqual([]);
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
        const [rooms, corridors] = both({
          symmetry,
          placement,
          deadEndChance: 0.3,
          loopChance: 0.3,
          doorChance: 0.5,
        });

        // when
        const results = SEEDS.map((seed) =>
          dungeon(rooms, corridors, seed, width, height),
        );

        // then
        expect(
          results.map((result) =>
            asymmetry(result, symmetry, placement === 'lattice'),
          ),
        ).toEqual(results.map(() => 0));
      },
    );

    it.each(kinds)(
      'keeps %s dungeons joined, free of jumps and rooms apart',
      (symmetry) => {
        // given
        const [rooms, corridors] = both({ symmetry, roomSpacing: 2 });

        // when
        const results = SEEDS.map((seed) => dungeon(rooms, corridors, seed));

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

    it('gives twins the same number of exits', () => {
      // given
      const [rooms, corridors] = both({ symmetry: 'horizontal' });

      // when
      const results = SEEDS.map((seed) => dungeon(rooms, corridors, seed));

      // then
      for (const { rooms: placed } of results) {
        for (const room of placed) {
          const twin = placed.find(
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

    it('is less symmetric at a lower chance, yet joined', () => {
      // given
      const total = (symmetryChance: number) =>
        SEEDS.map((seed) =>
          dungeon(...both({ symmetry: 'horizontal', symmetryChance }), seed),
        );

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

    it('joins symmetric rooms with free corridors', () => {
      // given
      const rooms = { symmetry: 'both' as LayoutSymmetry };

      // when
      const results = SEEDS.map((seed) => dungeon(rooms, {}, seed));

      // then
      expect(results.every(isConnected)).toBe(true);
      expect(
        results.some((result) => asymmetry(result, 'both', false) > 0),
      ).toBe(true);
    });

    it.each(['whirlpool', 'snowflake'] as const)(
      'lays out corridors differently with %s corridor symmetry',
      (corridorSymmetry) => {
        // given
        const plain = dungeon();

        // when
        const symmetric = dungeon({}, { corridorSymmetry });

        // then
        expect(symmetric.grid.toString()).not.toBe(plain.grid.toString());
      },
    );

    it('keeps corridor symmetry dungeons joined and free of jumps', () => {
      // given
      const corridors = {
        corridorSymmetry: 'whirlpool',
        straight: 0.2,
      } as const;

      // when
      const results = SEEDS.map((seed) => dungeon({}, corridors, seed));

      // then
      for (const result of results) {
        expect(isConnected(result)).toBe(true);
        expect(diagonalJumps(result.grid)).toEqual([]);
      }
    });

    it('combines a mirror layout with corridor symmetry', () => {
      // given
      const [rooms, corridors] = both({
        symmetry: 'both',
        corridorSymmetry: 'snowflake',
      });

      // when
      const results = SEEDS.map((seed) => dungeon(rooms, corridors, seed));

      // then
      expect(results.map((result) => asymmetry(result, 'both', false))).toEqual(
        results.map(() => 0),
      );
    });

    it('ignores corridor symmetry at a chance of 0', () => {
      // given
      const plain = dungeon({}, {}, 3);

      // when
      const ignored = dungeon(
        {},
        { corridorSymmetry: 'snowflake', corridorSymmetryChance: 0 },
        3,
      );

      // then
      expect(ignored.grid.toString()).toBe(plain.grid.toString());
    });
  });

  describe('dropping rooms', () => {
    /** Three rooms far apart, the last of them walled in by a ring of reserved rock. */
    const walledIn = step('wallIn', {}, (state: MapState) => {
      for (let y = 26; y <= 33; ++y) {
        for (let x = 46; x <= 53; ++x) {
          if (x === 46 || x === 53 || y === 26 || y === 33) {
            reserveTile(state, x, y, Reserve.Solid);
          }
        }
      }
      return {};
    });
    const floors = [
      { x: 5, y: 5, width: 4, height: 4 },
      { x: 25, y: 5, width: 4, height: 4 },
      { x: 48, y: 28, width: 4, height: 4 },
    ];
    const run = () =>
      pipeline(wallMap(), [handRooms(floors), walledIn, digCorridors()], {
        random: mulberry32(1),
      });

    it('drops an ordinary room that cannot be joined, with its shape', () => {
      // when
      const { rooms, roomShapes } = run();

      // then
      expect(rooms.map(({ id, x }) => [id, x])).toEqual([
        [0, 5],
        [1, 25],
      ]);
      expect(roomShapes.map(({ x }) => x)).toEqual([4, 24]);
    });

    it('turns the tiles of a dropped room back into rock, unreserved', () => {
      // when
      const { grid, reserved } = run();

      // then
      const footprint = allTiles(grid).filter(
        ({ x, y }) => x >= 47 && x <= 52 && y >= 27 && y <= 32,
      );
      expect(footprint.every(({ x, y }) => grid.get(x, y) === Tile.Wall)).toBe(
        true,
      );
      expect(
        footprint.every(
          ({ x, y }) => reserved[y * grid.width + x] === Reserve.None,
        ),
      ).toBe(true);
    });

    it('keeps the ids, exits and shapes in step after a drop', () => {
      // given
      const rooms = {
        roomSpacing: 2,
        roomWidth: { min: 3, max: 6 },
        roomHeight: { min: 3, max: 6 },
        fill: 0.4,
      };

      // when
      const results = Array.from({ length: 30 }, (_, i) =>
        dungeon(rooms, {}, i + 1, 25, 25),
      );

      // then
      for (const { rooms: placed, roomShapes, exits } of results) {
        expect(placed.map(({ id }) => id)).toEqual(placed.map((_, i) => i));
        expect(roomShapes).toHaveLength(placed.length);
        for (const room of placed) {
          const shape = roomShapes[room.id] as RoomShape;
          expect([shape.x, shape.y]).toEqual([room.x - 1, room.y - 1]);
          expect(
            exits.filter(({ rooms: ids }) => ids.includes(room.id)).length,
          ).toBe(room.exitCount);
        }
      }
    });
  });

  describe('templates', () => {
    it('joins the fixed exit of a template', () => {
      // given
      const steps = [withCloset(() => false), digCorridors()] as const;

      // when
      const result = pipeline(wallMap(), steps, { random: mulberry32(1) });

      // then
      const exit = result.roomExits.find(
        ({ position }) => position.x === 31 && position.y === 20,
      );
      expect(exit?.rooms).toEqual([2]);
      expect(result.grid.get(31, 20)).toBe(Tile.Door);
      const fromFirst = reachable(
        { ...result, exits: result.roomExits, fill: 0 },
        { x: 5, y: 5 },
      );
      expect(fromFirst.has(21 * 61 + 31)).toBe(true);
    });

    it('routes again before failing, and then throws a TemplatePlacementError', () => {
      // given
      const state = wallMap()();
      const placed = withCloset(() => true)(state);
      let tries = 0;

      // when
      let error: unknown;
      try {
        joinRooms(
          { ...state, ...placed },
          mulberry32(1),
          resolveCorridorSettings({}),
          () => ++tries,
        );
      } catch (thrown) {
        error = thrown;
      }

      // then
      expect(error).toBeInstanceOf(TemplatePlacementError);
      expect((error as Error).message).toContain('room 2 cannot be joined');
      expect(tries).toBe(3);
    });

    it('never drops a templated room, and leaves the map as it was when it fails', () => {
      // given
      const state = wallMap()();
      const placed = withCloset(() => true)(state);
      const before = state.grid.toString();

      // when
      const join = () =>
        digCorridors()({ ...state, ...placed }, { random: mulberry32(1) });

      // then
      expect(join).toThrow(TemplatePlacementError);
      expect(state.grid.toString()).toBe(before);
    });

    it('is retried by the pipeline with a new map', () => {
      // given
      let maps = 0;
      const steps = [withCloset(() => ++maps === 1), digCorridors()];

      // when
      const result = pipeline(wallMap(), steps, { random: mulberry32(1) });

      // then
      expect(result.attempts).toBe(2);
      expect(result.failures.map(({ step: name }) => name)).toEqual([
        'digCorridors',
      ]);
      expect(result.failures[0]?.error).toBeInstanceOf(TemplatePlacementError);
    });
  });

  describe('composition', () => {
    it('reserves every exit it opens and the openable tiles round it', () => {
      // given
      const rooms = { roomSpacing: 3 };

      // when
      const { grid, reserved, exits } = dungeon(rooms);

      // then
      for (const { position } of exits) {
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

    it('never digs through a reserved tile', () => {
      // given
      const wall = step('reserveWall', {}, (state: MapState) => {
        for (let y = 1; y < 35; ++y) {
          reserveTile(state, 30, y, Reserve.Solid);
        }
        return {};
      });
      const floors = [
        { x: 5, y: 5, width: 4, height: 4 },
        { x: 50, y: 5, width: 4, height: 4 },
      ];

      // when
      const { grid } = pipeline(
        wallMap(),
        [handRooms(floors), wall, digCorridors()],
        { random: mulberry32(1) },
      );

      // then
      const dug = allTiles(grid).filter(
        ({ x, y }) => x === 30 && y < 35 && grid.get(x, y) !== Tile.Wall,
      );
      expect(dug).toEqual([]);
      expect(grid.get(30, 35)).toBe(Tile.Floor);
    });

    it('leaves rooms that have exits alone and appends to roomExits', () => {
      // given
      const earlier: Exit = {
        position: { x: 7, y: 4 },
        rooms: [0],
        door: true,
      };
      const floors = [
        { x: 5, y: 5, width: 4, height: 4 },
        { x: 25, y: 5, width: 4, height: 4 },
        { x: 45, y: 25, width: 4, height: 4 },
      ];
      const opened = step(
        'openFirst',
        { adds: ['rooms', 'roomExits'] },
        (state: MapState & { rooms: Room[] }) => ({
          rooms: state.rooms.map((room) =>
            room.id === 0
              ? { ...room, exits: [0], exitCount: 1, doorCount: 1 }
              : room,
          ),
          roomExits: [earlier],
        }),
      );

      // when
      const { rooms, roomExits } = pipeline(
        wallMap(),
        [handRooms(floors), opened, digCorridors()],
        { random: mulberry32(1) },
      );

      // then
      expect(rooms[0]?.exits).toEqual([0]);
      expect(roomExits[0]).toEqual(earlier);
      expect(
        roomExits.slice(1).every(({ rooms: ids }) => !ids.includes(0)),
      ).toBe(true);
      expect(rooms[1]?.exits.every((index) => index >= 1)).toBe(true);
    });
  });

  describe('features', () => {
    /** A step that digs floor wherever `isFloor` says, reserving nothing, as a feature step would. */
    const feature = (isFloor: (x: number, y: number) => boolean) =>
      step('feature', {}, (state: MapState) => {
        for (const { x, y } of allTiles(state.grid)) {
          if (isFloor(x, y)) {
            state.grid.set(x, y, Tile.Floor);
          }
        }
        return {};
      });
    /** A hall of 15 by 11 with pillars of 2 by 2. */
    const hall = feature(
      (x, y) =>
        x >= 20 &&
        x <= 34 &&
        y >= 14 &&
        y <= 24 &&
        !((x - 20) % 4 >= 2 && (y - 14) % 4 >= 2),
    );
    const cavern = feature((x, y) => (x - 30) ** 2 + (y - 20) ** 2 * 2 < 40);
    const corners = [
      { x: 5, y: 5, width: 4, height: 4 },
      { x: 50, y: 5, width: 4, height: 4 },
      { x: 5, y: 30, width: 4, height: 4 },
      { x: 50, y: 30, width: 4, height: 4 },
    ];
    const join = (
      steps: Parameters<typeof pipeline>[1],
      seed = 1,
    ): ReturnType<typeof pipeline> & {
      rooms: Room[];
      roomShapes: RoomShape[];
      roomExits: Exit[];
    } => pipeline(wallMap(), steps, { random: mulberry32(seed) }) as never;

    it.each([
      ['a pillar hall', hall],
      ['a cavern', cavern],
      [
        'floor that spans the map, as a mine does',
        feature(
          (x, y) =>
            (y === 20 && x > 1 && x < 59) || (x === 30 && y > 1 && y < 39),
        ),
      ],
    ])('joins %s and the rooms into one piece', (_name, made) => {
      // when
      const results = SEEDS.map((seed) =>
        join([made, handRooms(corners), digCorridors()], seed),
      );

      // then
      expect(results.map(({ grid }) => pieces(grid))).toEqual(
        SEEDS.map(() => 1),
      );
    });

    it('joins new rooms to the corridors of an earlier step', () => {
      // given
      const left = { area: { width: { min: 28, max: 28 } } };

      // when
      const results = SEEDS.map((seed) =>
        join(
          [
            placeScatteredRooms(left),
            digCorridors(),
            placeScatteredRooms(),
            digCorridors(),
          ],
          seed,
        ),
      );

      // then
      expect(results.map(({ grid }) => pieces(grid))).toEqual(
        SEEDS.map(() => 1),
      );
    });

    it('never lists a stand-in among the rooms, their shapes or their exits', () => {
      // when
      const { rooms, roomShapes, roomExits } = join([
        hall,
        handRooms(corners),
        digCorridors(),
      ]);

      // then
      expect(rooms).toHaveLength(4);
      expect(roomShapes).toHaveLength(4);
      for (const { position } of roomExits) {
        expect(
          roomShapes.some(
            (shape) =>
              position.x >= shape.x &&
              position.x < shape.x + shape.width &&
              position.y >= shape.y &&
              position.y < shape.y + shape.height,
          ),
        ).toBe(true);
      }
    });

    it('opens the wall of a stand-in into floor, with no door', () => {
      // given
      const before = wallMap()();
      cavern(before);

      // when
      const { grid } = join([
        cavern,
        handRooms(corners),
        digCorridors({ doorChance: 1 }),
      ]);

      // then
      const round = allTiles(grid).filter(
        ({ x, y }) =>
          before.grid.get(x, y) === Tile.Wall &&
          NEIGHBORS.some(
            (step) => before.grid.get(x + step.x, y + step.y) === Tile.Floor,
          ),
      );
      const opened = round.filter(({ x, y }) => grid.get(x, y) !== Tile.Wall);
      expect(opened.length).toBeGreaterThan(0);
      expect(opened.every(({ x, y }) => grid.get(x, y) === Tile.Floor)).toBe(
        true,
      );
    });

    it('leaves the rock that a stand-in encloses alone', () => {
      // when
      const results = SEEDS.map((seed) =>
        join([hall, handRooms(corners), digCorridors()], seed),
      );

      // then
      for (const { grid } of results) {
        const pillars = allTiles(grid).filter(
          ({ x, y }) =>
            x >= 20 &&
            x <= 34 &&
            y >= 14 &&
            y <= 24 &&
            (x - 20) % 4 >= 2 &&
            (y - 14) % 4 >= 2,
        );
        expect(pillars.every(({ x, y }) => grid.get(x, y) === Tile.Wall)).toBe(
          true,
        );
      }
    });

    it('fails when a stand-in cannot be joined, and the pipeline tries a new map', () => {
      // given
      let maps = 0;
      const walledIn = step('wallIn', {}, (state: MapState) => {
        if (++maps === 1) {
          for (const { x, y } of allTiles(state.grid)) {
            if (Math.max(Math.abs(x - 30), Math.abs(y - 20)) === 7) {
              reserveTile(state, x, y, Reserve.Solid);
            }
          }
        }
        return {};
      });

      // when
      const { attempts, failures } = pipeline(
        wallMap(),
        [cavern, walledIn, handRooms(corners), digCorridors()],
        { random: mulberry32(1) },
      );

      // then
      expect(attempts).toBe(2);
      expect(failures[0]?.step).toBe('digCorridors');
      expect(failures[0]?.error).not.toBeInstanceOf(TemplatePlacementError);
      expect(String(failures[0]?.error)).toMatch(
        /the floor at \(\d+, \d+\), which is no room, cannot be joined/,
      );
    });
  });

  describe('validation', () => {
    it.each([
      [{ connection: 'random' }, /connection/],
      [{ placement: 'grid' }, /placement/],
      [{ exitsPerRoom: { min: 0, max: 2 } }, /exitsPerRoom/],
      [{ loopChance: 2 }, /loopChance/],
      [{ deadEndChance: -1 }, /deadEndChance/],
      [{ doorChance: 1.5 }, /doorChance/],
      [{ straight: 2 }, /straight/],
      [{ horizontalBias: -1 }, /horizontalBias/],
      [{ symmetry: 'diagonal' }, /symmetry/],
      [{ symmetryChance: 2 }, /symmetryChance/],
      [{ corridorSymmetry: 'spiral' }, /corridorSymmetry/],
      [{ corridorSymmetryChance: -0.5 }, /corridorSymmetryChance/],
    ])('rejects %j', (options, message) => {
      // when
      const make = () => digCorridors(options as DigCorridorsOptions);

      // then
      expect(make).toThrow(RangeError);
      expect(make).toThrow(message);
    });

    it('joins pieces of floor when there are no rooms', () => {
      // given
      const halls = step('halls', {}, ({ grid }) => {
        for (const [x0, y0] of [
          [5, 5],
          [30, 8],
          [15, 24],
        ] as const) {
          for (let y = y0; y < y0 + 6; ++y) {
            for (let x = x0; x < x0 + 8; ++x) {
              grid.set(x, y, Tile.Floor);
            }
          }
        }
        return {};
      });

      // when
      const { grid, rooms, roomShapes, roomExits } = pipeline(
        wallMap(),
        [halls, digCorridors()],
        { random: mulberry32(1) },
      );

      // then
      expect([rooms, roomShapes, roomExits]).toEqual([[], [], []]);
      const seen = new Set<number>([8 * 61 + 8]);
      const queue = [{ x: 8, y: 8 }];
      for (let tile = queue.pop(); tile; tile = queue.pop()) {
        for (const [dx, dy] of [
          [1, 0],
          [-1, 0],
          [0, 1],
          [0, -1],
        ] as const) {
          const [x, y] = [tile.x + dx, tile.y + dy];
          if (
            grid.inBounds(x, y) &&
            grid.get(x, y) !== Tile.Wall &&
            !seen.has(y * grid.width + x)
          ) {
            seen.add(y * grid.width + x);
            queue.push({ x, y });
          }
        }
      }
      let floor = 0;
      for (let y = 0; y < grid.height; ++y) {
        for (let x = 0; x < grid.width; ++x) {
          floor += grid.get(x, y) === Tile.Wall ? 0 : 1;
        }
      }
      expect(seen.size).toBe(floor);
    });

    it('needs a map that starts as wall', () => {
      // when
      const run = () =>
        pipeline(emptyMap({ width: 30, height: 20, tile: Tile.Floor }), [
          placeScatteredRooms(),
          digCorridors(),
        ]);

      // then
      expect(run).toThrow(RangeError);
    });
  });
});
