import { describe, expect, it } from 'vitest';
import { digNoiseCave } from '../cave/dig-noise-cave';
import { digVeins } from '../veins/dig-veins';
import { findCaveRegions } from '../cave/find-cave-regions';
import { digCellularCave } from '../cave/dig-cellular-cave';
import type { Grid } from '../core/grid';
import type { Point } from '../core/point';
import { Tile } from '../core/tile';
import { digCorridors } from '../dungeon/dig-corridors';
import { placeClusteredRooms } from '../dungeon/place-clustered-rooms';
import { placeScatteredRooms } from '../dungeon/place-scattered-rooms';
import { emptyMap } from '../pipeline/empty-map';
import { pipeline } from '../pipeline/pipeline';
import type { AnyStep } from '../pipeline/pipeline-chain';
import { createRoomMap } from '../rooms/create-room-map';
import type { Exit } from '../rooms/exit';
import type { Room } from '../rooms/room';
import type { RoomShape } from '../rooms/room-shape';
import { SEEDS } from '../test-helpers/dungeon-checks';
import { TemplateCell } from '../rooms/templates/template-cell';
import { mulberry32 } from '../test-helpers/mulberry32';
import { digFishbone } from './dig-fishbone';
import { digPillarHalls } from './dig-pillar-halls';

const base = emptyMap({ width: 61, height: 41, tile: Tile.Wall });

/** The number of pieces that the tiles that are not wall make, joined along edges. */
function pieces(grid: Grid): number {
  const open = grid.clone();
  for (let y = 0; y < grid.height; ++y) {
    for (let x = 0; x < grid.width; ++x) {
      if (grid.get(x, y) !== Tile.Wall) {
        open.set(x, y, Tile.Floor);
      }
    }
  }
  return findCaveRegions(open).length;
}

/** Whether a tile is open and touches the floor of the shape along an edge. */
function entersFloor(grid: Grid, shape: RoomShape, { x, y }: Point): boolean {
  const floorAt = (fx: number, fy: number) =>
    shape.cells[fy - shape.y]?.[fx - shape.x] === TemplateCell.Floor;
  return (
    grid.get(x, y) !== Tile.Wall &&
    (floorAt(x - 1, y) ||
      floorAt(x + 1, y) ||
      floorAt(x, y - 1) ||
      floorAt(x, y + 1))
  );
}

/** Whether every exit a room lists lists the room back, and the other way round. */
function exitsAgree(rooms: readonly Room[], exits: readonly Exit[]): boolean {
  return (
    rooms.every(
      (room) =>
        room.exitCount === room.exits.length &&
        room.exits.every((index) => exits[index]?.rooms.includes(room.id)),
    ) &&
    exits.every((exit, index) =>
      exit.rooms.every((id) => rooms[id]?.exits.includes(index)),
    )
  );
}

function build(steps: AnyStep[], seed: number) {
  return pipeline(base, steps, { random: mulberry32(seed) });
}

describe('features with rooms', () => {
  it.each([
    [
      'a pillar hall in an area and scattered rooms',
      () => [
        digPillarHalls({
          area: { width: { min: 16, max: 16 }, height: { min: 12, max: 12 } },
        }),
        placeScatteredRooms(),
        digCorridors(),
      ],
    ],
    [
      'a noise cavern in an area and grown rooms',
      () => [
        digNoiseCave({
          largestOnly: true,
          area: { width: { min: 16, max: 16 }, height: { min: 12, max: 12 } },
        }),
        placeClusteredRooms(),
        digCorridors(),
      ],
    ],
    [
      'a whole mine and scattered rooms',
      () => [
        digFishbone(),
        placeScatteredRooms({ roomCount: { min: 4, max: 6 } }),
        digCorridors(),
      ],
    ],
    [
      'a cavern in an area and scattered rooms, joined by veins',
      () => [
        digCellularCave({
          fillChance: 0.5,
          area: { width: { min: 24, max: 24 }, height: { min: 16, max: 16 } },
        }),
        placeScatteredRooms({ roomCount: { min: 4, max: 6 } }),
        digVeins({ density: 0 }),
      ],
    ],
  ] as [string, () => AnyStep[]][])(
    'joins %s into one piece',
    (_name, steps) => {
      // when
      const results = SEEDS.map((seed) => build(steps(), seed));

      // then
      expect(results.map(({ grid }) => pieces(grid))).toEqual(
        SEEDS.map(() => 1),
      );
    },
  );

  it('lists only the rooms of the room step as rooms', () => {
    // given
    const rooms = { roomCount: { min: 5, max: 5 } };

    // when
    const results = SEEDS.map(
      (seed) =>
        build(
          [digFishbone(), placeScatteredRooms(rooms), digCorridors()],
          seed,
        ) as {
          rooms?: unknown[];
          roomShapes?: unknown[];
        },
    );

    // then
    for (const { rooms: listed, roomShapes } of results) {
      expect(listed).toHaveLength(5);
      expect(roomShapes).toHaveLength(5);
    }
  });

  it.each(SEEDS)(
    'keeps a hall and a cavern as rooms, entered by the corridors, ahead of the rooms, seed %i',
    (seed) => {
      // given
      const area = {
        width: { min: 16, max: 16 },
        height: { min: 12, max: 12 },
      };
      const steps = [
        digPillarHalls({ halls: { min: 1, max: 1 }, area }),
        digNoiseCave({ largestOnly: true, area }),
        placeScatteredRooms(),
        digCorridors(),
      ] as const;

      // when
      const { rooms, roomShapes } = pipeline(base, steps, {
        random: mulberry32(seed),
      });

      // then
      const [hall, cavern, ...placed] = rooms;
      expect([hall?.kind, cavern?.kind]).toEqual(['pillarHall', 'cavern']);
      expect(hall?.exitCount).toBeGreaterThan(0);
      expect(cavern?.exitCount).toBeGreaterThan(0);
      expect(placed.length).toBeGreaterThan(0);
      expect(placed.every(({ kind }) => kind === 'room')).toBe(true);
      expect(rooms.map(({ id }) => id)).toEqual(rooms.map((_, i) => i));
      expect(roomShapes).toHaveLength(rooms.length);
    },
  );

  it.each(SEEDS)('joins pillar halls with no other rooms, seed %i', (seed) => {
    // given
    const steps = [digPillarHalls(), digCorridors()] as const;

    // when
    const { grid, rooms } = pipeline(base, steps, {
      random: mulberry32(seed),
    });

    // then
    expect(rooms.every(({ kind }) => kind === 'pillarHall')).toBe(true);
    expect(pieces(grid)).toBe(1);
  });

  it.each(SEEDS)(
    'records where the corridors enter a hall and a cavern, seed %i',
    (seed) => {
      // given
      const area = {
        width: { min: 16, max: 16 },
        height: { min: 12, max: 12 },
      };
      const steps = [
        digPillarHalls({ halls: { min: 1, max: 1 }, area }),
        digNoiseCave({ largestOnly: true, area }),
        placeScatteredRooms(),
        digCorridors(),
      ] as const;

      // when
      const { grid, rooms, roomShapes, roomExits } = pipeline(base, steps, {
        random: mulberry32(seed),
      });

      // then
      expect(exitsAgree(rooms, roomExits)).toBe(true);
      for (const room of rooms.slice(0, 2)) {
        for (const index of room.exits) {
          const { position } = roomExits[index] as Exit;
          expect(
            entersFloor(grid, roomShapes[room.id] as RoomShape, position),
          ).toBe(true);
        }
      }
    },
  );

  it.each(SEEDS)(
    'records where the veins enter a hall, a cavern and the rooms, seed %i',
    (seed) => {
      // given
      const area = {
        width: { min: 16, max: 16 },
        height: { min: 12, max: 12 },
      };
      const steps = [
        digPillarHalls({ halls: { min: 1, max: 1 }, area }),
        digNoiseCave({ largestOnly: true, area }),
        placeScatteredRooms(),
        digVeins({ density: 0 }),
      ] as const;

      // when
      const { grid, rooms, roomShapes, roomExits } = pipeline(base, steps, {
        random: mulberry32(seed),
      });

      // then
      expect(exitsAgree(rooms, roomExits)).toBe(true);
      expect(rooms.every(({ exitCount }) => exitCount > 0)).toBe(true);
      for (const room of rooms.slice(0, 2)) {
        for (const index of room.exits) {
          const { position } = roomExits[index] as Exit;
          expect(
            entersFloor(grid, roomShapes[room.id] as RoomShape, position),
          ).toBe(true);
        }
      }
      for (const room of rooms.slice(2)) {
        for (const index of room.exits) {
          const { x, y } = (roomExits[index] as Exit).position;
          const shape = roomShapes[room.id] as RoomShape;
          expect(shape.cells[y - shape.y]?.[x - shape.x]).toBe(
            TemplateCell.OptionalExit,
          );
        }
      }
    },
  );

  it('maps the floor of the halls, without their pillars, and of the rooms', () => {
    // given
    const steps = [
      digPillarHalls({ halls: { min: 1, max: 1 } }),
      placeScatteredRooms(),
      digCorridors(),
    ] as const;
    const result = build([...steps], 3) as unknown as {
      grid: Grid;
      rooms: Room[];
      roomShapes: RoomShape[];
    };

    // when
    const map = createRoomMap(result);

    // then
    const { grid, rooms } = result;
    expect(new Set(map)).toEqual(new Set([-1, ...rooms.map(({ id }) => id)]));
    map.forEach((id, at) => {
      if (id !== -1) {
        expect(grid.get(at % grid.width, Math.floor(at / grid.width))).toBe(
          Tile.Floor,
        );
      }
    });
  });
});
