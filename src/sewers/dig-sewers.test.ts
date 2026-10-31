import { describe, expect, it } from 'vitest';
import { DIRECTIONS } from '../core/directions';
import type { Grid } from '../core/grid';
import type { Point } from '../core/point';
import { Tile } from '../core/tile';
import { digCorridors } from '../dungeon/dig-corridors';
import { placeScatteredRooms } from '../dungeon/place-scattered-rooms';
import { emptyMap } from '../pipeline/empty-map';
import { pipeline } from '../pipeline/pipeline';
import { Reserve } from '../pipeline/reserve';
import { reserveTile } from '../pipeline/reserve-tile';
import { step } from '../pipeline/step';
import { createRoomMap } from '../rooms/create-room-map';
import type { Room } from '../rooms/room';
import type { SewerGroup } from '../rooms/sewer-group';
import type { SewerMouth } from '../rooms/sewer-mouth';
import { diagonalJumps } from '../test-helpers/dungeon-checks';
import { mulberry32 } from '../test-helpers/mulberry32';
import { sewersOf } from '../test-helpers/sewers-of';
import { digVeins } from '../veins/dig-veins';
import { digSewers } from './dig-sewers';
import type { DigSewersOptions } from './dig-sewers-options';

const SEEDS = Array.from({ length: 20 }, (_, i) => i + 1);

const wallMap = () => emptyMap({ width: 70, height: 40, tile: Tile.Wall });

/** Runs the step alone on a wall map of 70 by 40. */
function dig(options: DigSewersOptions = {}, seed = 1) {
  const result = pipeline(wallMap(), [digSewers(options)], {
    random: mulberry32(seed),
  });
  return { ...result, sewers: sewersOf(result.roomGroups) };
}

const isWater = (grid: Grid, { x, y }: Point) =>
  grid.get(x, y) === Tile.ShallowWater;

const neighbors = ({ x, y }: Point): Point[] =>
  DIRECTIONS.map((step) => ({ x: x + step.x, y: y + step.y }));

/** Every tile of the map that holds one of the tiles. */
function tilesOf(grid: Grid, ...kinds: Tile[]): Point[] {
  const tiles: Point[] = [];
  for (let y = 0; y < grid.height; ++y) {
    for (let x = 0; x < grid.width; ++x) {
      if (kinds.includes(grid.get(x, y))) {
        tiles.push({ x, y });
      }
    }
  }
  return tiles;
}

/** How many of the tiles one flood along edges, from the first of them, reaches. */
function reached(grid: Grid, tiles: readonly Point[]): number {
  const open = new Set(tiles.map(({ x, y }) => y * grid.width + x));
  const [first] = tiles;
  if (!first) {
    return 0;
  }
  const seen = new Set([first.y * grid.width + first.x]);
  for (const queue = [first]; queue.length > 0;) {
    for (const next of neighbors(queue.pop() as Point)) {
      const key = next.y * grid.width + next.x;
      if (open.has(key) && !seen.has(key)) {
        seen.add(key);
        queue.push(next);
      }
    }
  }
  return seen.size;
}

/** The floor outside the sewer's rooms, such as corridors, that touches its water. */
function floorIntoWater(result: {
  grid: Grid;
  rooms: Room[];
  roomShapes: Parameters<typeof createRoomMap>[0]['roomShapes'];
}): Point[] {
  const { grid, rooms } = result;
  const roomMap = createRoomMap(result);
  const inSewer = ({ x, y }: Point) => {
    const room = rooms[roomMap[y * grid.width + x] ?? -1];
    return (
      room?.kind === 'sewerChamber' ||
      room?.kind === 'sewerTunnel' ||
      room?.kind === 'cistern'
    );
  };
  return tilesOf(grid, Tile.Floor, Tile.Door).filter(
    (tile) =>
      !inSewer(tile) && neighbors(tile).some((next) => isWater(grid, next)),
  );
}

describe('digSewers', () => {
  it('digs the same sewer from the same seed', () => {
    // given
    const make = () => dig({}, 7);

    // when
    const [first, second] = [make(), make()];

    // then
    expect(first.grid.toString()).toBe(second.grid.toString());
    expect(first.rooms).toEqual(second.rooms);
    expect(first.roomGroups).toEqual(second.roomGroups);
  });

  it('lays only floor, shallow water and bridges', () => {
    // given
    const results = SEEDS.map((seed) => dig({}, seed));

    // when
    const kinds = new Set(
      results.flatMap(({ grid }) =>
        tilesOf(grid, ...Object.values(Tile)).map(({ x, y }) => grid.get(x, y)),
      ),
    );

    // then
    expect(kinds).toEqual(
      new Set([Tile.Wall, Tile.Floor, Tile.ShallowWater, Tile.Bridge]),
    );
  });

  it('joins every walkway tile to every other without wading', () => {
    // given
    const results = SEEDS.map((seed) =>
      dig({ branches: { min: 6, max: 8 } }, seed),
    );

    // when
    const walkways = results.map(({ grid }) =>
      tilesOf(grid, Tile.Floor, Tile.Bridge),
    );

    // then
    results.forEach(({ grid }, index) => {
      const tiles = walkways[index] as Point[];
      expect(reached(grid, tiles)).toBe(tiles.length);
    });
  });

  it('gives every tile of the sewer to exactly one chamber or tunnel of its group', () => {
    // given
    const results = SEEDS.map((seed) => dig({}, seed));

    // when
    const owners = results.map((result) => createRoomMap(result));

    // then
    results.forEach(({ grid, rooms }, index) => {
      const roomMap = owners[index] as Int32Array;
      const sewer = tilesOf(grid, Tile.Floor, Tile.ShallowWater, Tile.Bridge);
      expect(
        sewer.every(({ x, y }) => (roomMap[y * grid.width + x] ?? -1) >= 0),
      ).toBe(true);
      const area = rooms.reduce(
        (sum, { width, height }) => sum + width * height,
        0,
      );
      expect(area).toBe(sewer.length);
      expect(
        rooms.every(
          ({ kind, group }) =>
            (kind === 'sewerChamber' || kind === 'sewerTunnel') && group === 0,
        ),
      ).toBe(true);
    });
  });

  it('makes a sewer group with the trunk first and the branches after it', () => {
    // given
    const options = { branches: { min: 3, max: 3 } };

    // when
    const { sewers } = dig(options);

    // then
    const [sewer] = sewers;
    expect(sewers).toHaveLength(1);
    expect(sewer?.area).toEqual({ x: 0, y: 0, width: 70, height: 40 });
    expect(sewer?.canals.map(({ level }) => level)).toEqual([
      'trunk',
      'branch',
      'branch',
      'branch',
    ]);
    expect(sewer?.canals[0]?.parent).toBeUndefined();
  });

  it('digs only the trunk, a single tunnel, with no branches', () => {
    // given
    const options = { branches: { min: 0, max: 0 } };

    // when
    const { rooms, sewers } = dig(options);

    // then
    expect(sewers[0]?.canals).toHaveLength(1);
    expect(rooms.map(({ kind }) => kind)).toEqual(['sewerTunnel']);
  });

  it('meets the parent canal at right angles, beside its water', () => {
    // given
    const results = SEEDS.map((seed) =>
      dig({ branches: { min: 6, max: 8 } }, seed),
    );

    // when
    const canals = results.flatMap(({ grid, sewers }) =>
      (sewers[0] as SewerGroup).canals.flatMap((canal, index, all) =>
        canal.parent === undefined
          ? []
          : [{ grid, canal, parent: all[canal.parent], index }],
      ),
    );

    // then
    expect(canals.length).toBeGreaterThan(SEEDS.length);
    for (const { grid, canal, parent } of canals) {
      const [first, second] = canal.centerline as [Point, Point];
      const [a, b] = parent?.centerline as [Point, Point];
      const horizontal = first.y === second.y;
      expect(horizontal).toBe(a.x === b.x);
      // the tile before the first is the parent's water
      const before = { x: 2 * first.x - second.x, y: 2 * first.y - second.y };
      expect(isWater(grid, before)).toBe(true);
    }
  });

  it('ends every canal at a mouth that meets a wall', () => {
    // given
    const results = SEEDS.map((seed) => dig({}, seed));

    // when
    const sewers = results.map(({ grid, sewers: [sewer] }) => ({
      grid,
      sewer: sewer as SewerGroup,
    }));

    // then
    for (const { grid, sewer } of sewers) {
      expect(sewer.mouths).toHaveLength(sewer.canals.length + 1);
      for (const { position, wall, canal } of sewer.mouths) {
        const { centerline } = sewer.canals[canal] as SewerGroup['canals'][0];
        expect([centerline[0], centerline.at(-1)]).toContainEqual(position);
        expect(isWater(grid, position)).toBe(true);
        expect(wall && grid.get(wall.x, wall.y)).toBe(Tile.Wall);
        expect(neighbors(position)).toContainEqual(wall);
      }
    }
  });

  it('reserves the walls beside the water and the rock behind each mouth inside the map', () => {
    // given
    const results = SEEDS.map((seed) => dig({}, seed));

    // when
    const reservedOf = results.map(
      ({ grid, reserved }) =>
        (tile: Point) =>
          reserved[tile.y * grid.width + tile.x],
    );

    // then
    results.forEach(({ grid, sewers: [sewer] }, index) => {
      const at = reservedOf[index] as (tile: Point) => number | undefined;
      for (const water of tilesOf(grid, Tile.ShallowWater)) {
        for (const next of neighbors(water)) {
          if (grid.get(next.x, next.y) === Tile.Wall) {
            expect(at(next)).toBe(Reserve.Solid);
          }
        }
      }
      const inside = (sewer?.mouths ?? []).filter(
        (_, mouth) =>
          !sewer?.outfalls.some((outfall) => outfall.mouth === mouth),
      );
      for (const { position, wall } of inside) {
        const step = {
          x: (wall?.x ?? 0) - position.x,
          y: (wall?.y ?? 0) - position.y,
        };
        for (const depth of [2, 3]) {
          expect(
            at({
              x: position.x + depth * step.x,
              y: position.y + depth * step.y,
            }),
          ).toBe(Reserve.Solid);
        }
      }
    });
  });

  it('leaves the walls beside the walkways inside the map free', () => {
    // given
    const { grid, reserved } = dig();

    // when
    const walls = tilesOf(grid, Tile.Wall).filter(
      (wall) =>
        grid.inBounds(wall.x - 1, wall.y - 1) &&
        grid.inBounds(wall.x + 1, wall.y + 1) &&
        neighbors(wall).some(({ x, y }) => grid.get(x, y) === Tile.Floor) &&
        !neighbors(wall).some((next) => isWater(grid, next)),
    );

    // then
    expect(walls.length).toBeGreaterThan(0);
    expect(
      walls.every(({ x, y }) => reserved[y * grid.width + x] === Reserve.None),
    ).toBe(true);
  });

  it('ends a branch in a head chamber by the head chance, where one fits', () => {
    // given
    const kindsAtMouths = (headChance: number) =>
      SEEDS.flatMap((seed) => {
        const result = dig({ headChance }, seed);
        const roomMap = createRoomMap(result);
        return (result.sewers[0]?.mouths ?? [])
          .filter(({ canal }) => canal > 0)
          .map(
            ({ position }) =>
              result.rooms[
                roomMap[position.y * result.grid.width + position.x] ?? -1
              ]?.kind,
          );
      });

    // when
    const [always, never] = [kindsAtMouths(1), kindsAtMouths(0)];

    // then
    expect(always.length).toBeGreaterThan(0);
    expect(never.length).toBeGreaterThan(0);
    const heads = always.filter((kind) => kind === 'sewerChamber');
    expect(heads.length).toBeGreaterThan(always.length / 2);
    expect(new Set(never)).toEqual(new Set(['sewerTunnel']));
  });

  it('lays only the bridge the walkways need with no bridge chance', () => {
    // given
    const options = {
      branches: { min: 0, max: 0 },
      trunkWidth: { min: 2, max: 2 },
      bridgeChance: 0,
    };

    // when
    const bridges = SEEDS.map((seed) =>
      tilesOf(dig(options, seed).grid, Tile.Bridge),
    );

    // then
    expect(bridges.every((tiles) => tiles.length === 2)).toBe(true);
  });

  it('runs the trunk the way the orientation says', () => {
    // given
    const trunkOf = (orientation: 'horizontal' | 'vertical') =>
      dig({ orientation, branches: { min: 0, max: 0 } }).sewers[0]?.canals[0]
        ?.centerline as Point[];

    // when
    const [horizontal, vertical] = [trunkOf('horizontal'), trunkOf('vertical')];

    // then
    expect(new Set(horizontal.map(({ y }) => y)).size).toBe(1);
    expect(new Set(vertical.map(({ x }) => x)).size).toBe(1);
  });

  it('makes the water as wide as the canal says', () => {
    // given
    const options = {
      orientation: 'horizontal' as const,
      trunkWidth: { min: 4, max: 4 },
      branches: { min: 0, max: 0 },
    };

    // when
    const { grid, sewers } = dig(options);

    // then
    const trunk = sewers[0]?.canals[0];
    const middle = trunk?.centerline[10] as Point;
    const column = Array.from({ length: grid.height }, (_, y) =>
      grid.get(middle.x, y),
    ).filter((tile) => tile === Tile.ShallowWater || tile === Tile.Bridge);
    expect(trunk?.width).toBe(4);
    expect(column).toHaveLength(4);
  });

  it('digs a sewer in each area, inside it', () => {
    // given
    const options = {
      area: { width: { min: 30, max: 30 }, height: { min: 16, max: 16 } },
      count: { min: 2, max: 2 },
      outfalls: { min: 0, max: 0 },
    };

    // when
    const results = SEEDS.slice(0, 5).map((seed) => dig(options, seed));

    // then
    for (const { rooms, sewers } of results) {
      expect(sewers).toHaveLength(2);
      for (const room of rooms) {
        const { area } = sewers[room.group ?? -1] as SewerGroup;
        expect(room.x).toBeGreaterThan(area.x);
        expect(room.y).toBeGreaterThan(area.y);
        expect(room.x + room.width).toBeLessThan(area.x + area.width);
        expect(room.y + room.height).toBeLessThan(area.y + area.height);
      }
    }
  });

  it('keeps off reserved tiles', () => {
    // given
    const block = { x: 25, y: 12, width: 20, height: 16 };
    const reserve = step('reserveBlock', {}, (state) => {
      for (let y = block.y; y < block.y + block.height; ++y) {
        for (let x = block.x; x < block.x + block.width; ++x) {
          reserveTile(state, x, y, Reserve.Solid);
        }
      }
      return {};
    });

    // when
    const grids = SEEDS.map(
      (seed) =>
        pipeline(wallMap(), [reserve, digSewers()], {
          random: mulberry32(seed),
        }).grid,
    );

    // then
    for (const grid of grids) {
      for (let y = block.y; y < block.y + block.height; ++y) {
        for (let x = block.x; x < block.x + block.width; ++x) {
          expect(grid.get(x, y)).toBe(Tile.Wall);
        }
      }
    }
  });

  it('is joined by digCorridors on its walkways, never at its water', () => {
    // given
    const steps = () =>
      [digSewers(), placeScatteredRooms(), digCorridors()] as const;

    // when
    const results = SEEDS.map((seed) =>
      pipeline(wallMap(), steps(), { random: mulberry32(seed) }),
    );

    // then
    for (const result of results) {
      const walkable = tilesOf(result.grid, Tile.Floor, Tile.Door, Tile.Bridge);
      expect(floorIntoWater(result)).toEqual([]);
      expect(reached(result.grid, walkable)).toBe(walkable.length);
      expect(
        result.rooms.some(
          ({ kind, exitCount }) =>
            (kind === 'sewerChamber' || kind === 'sewerTunnel') &&
            exitCount > 0,
        ),
      ).toBe(true);
    }
  });

  it('is joined by digVeins on its walkways, never at its water', () => {
    // given
    const steps = () =>
      [
        digSewers({
          area: { width: { min: 36, max: 36 }, height: { min: 20, max: 20 } },
          outfalls: { min: 0, max: 2 },
        }),
        digSewers({
          area: { width: { min: 20, max: 20 }, height: { min: 14, max: 14 } },
          outfalls: { min: 0, max: 2 },
        }),
        digVeins(),
      ] as const;

    // when
    const results = SEEDS.map((seed) =>
      pipeline(wallMap(), steps(), { random: mulberry32(seed) }),
    );

    // then
    for (const result of results) {
      const walkable = tilesOf(result.grid, Tile.Floor, Tile.Bridge);
      expect(floorIntoWater(result)).toEqual([]);
      expect(reached(result.grid, walkable)).toBe(walkable.length);
    }
  });

  it('makes as many outfalls as asked, each an Openable wall on the border beside a walkway', () => {
    // given
    const options = { outfalls: { min: 2, max: 2 } };

    // when
    const results = SEEDS.map((seed) => dig(options, seed));

    // then
    for (const { grid, reserved, sewers } of results) {
      const outfalls = sewers[0]?.outfalls ?? [];
      expect(outfalls.map(({ mouth }) => mouth)).toEqual([0, 1]);
      for (const { position } of outfalls) {
        const { x, y } = position;
        const onBorder =
          x === 0 || y === 0 || x === grid.width - 1 || y === grid.height - 1;
        expect(onBorder).toBe(true);
        expect(grid.get(x, y)).toBe(Tile.Wall);
        expect(reserved[y * grid.width + x]).toBe(Reserve.Openable);
        expect(
          neighbors(position).some(
            (next) => grid.get(next.x, next.y) === Tile.Floor,
          ),
        ).toBe(true);
      }
    }
  });

  it('stops the water of an outfall at a mouth in the border wall', () => {
    // given
    const options = { outfalls: { min: 2, max: 2 } };

    // when
    const { grid, sewers } = dig(options);

    // then
    for (const { mouth } of sewers[0]?.outfalls ?? []) {
      const { position, wall } = sewers[0]?.mouths[mouth] as SewerMouth;
      expect(isWater(grid, position)).toBe(true);
      expect(wall && grid.get(wall.x, wall.y)).toBe(Tile.Wall);
      expect(
        wall &&
          !grid.inBounds(2 * wall.x - position.x, 2 * wall.y - position.y),
      ).toBe(true);
    }
  });

  it('runs the water of an outfall off the map when it pierces the border', () => {
    // given
    const options = { outfalls: { min: 2, max: 2 }, pierceBorder: true };

    // when
    const { grid, sewers } = dig(options);

    // then
    const sewer = sewers[0] as SewerGroup;
    for (const { mouth } of sewer.outfalls) {
      const { position, wall } = sewer.mouths[mouth] as SewerMouth;
      const { x, y } = position;
      expect(isWater(grid, position)).toBe(true);
      expect(wall).toBeUndefined();
      expect(
        x === 0 || y === 0 || x === grid.width - 1 || y === grid.height - 1,
      ).toBe(true);
    }
  });

  it('keeps the sewer off the border with no outfalls', () => {
    // given
    const options = { outfalls: { min: 0, max: 0 } };

    // when
    const results = SEEDS.map((seed) => dig(options, seed));

    // then
    for (const { grid, reserved, sewers } of results) {
      expect(sewers[0]?.outfalls).toEqual([]);
      expect(reserved.includes(Reserve.Openable)).toBe(false);
      const [first, last] = [
        sewers[0]?.canals[0]?.centerline[0] as Point,
        sewers[0]?.canals[0]?.centerline.at(-1) as Point,
      ];
      expect(Math.min(first.x, first.y)).toBeGreaterThanOrEqual(3);
      expect(last.x).toBeLessThanOrEqual(grid.width - 4);
      expect(last.y).toBeLessThanOrEqual(grid.height - 4);
    }
  });

  it('fails the map when its area keeps off the border and an outfall is needed', () => {
    // given
    const ring = step('reserveBorder', {}, (state) => {
      const { width, height } = state.grid;
      for (let y = 0; y < height; ++y) {
        for (let x = 0; x < width; ++x) {
          if (x === 0 || y === 0 || x === width - 1 || y === height - 1) {
            reserveTile(state, x, y, Reserve.Solid);
          }
        }
      }
      return {};
    });
    const sewer = digSewers({
      area: { width: { min: 30, max: 30 }, height: { min: 16, max: 16 } },
      outfalls: { min: 1, max: 2 },
    });

    // when
    const run = () =>
      pipeline(wallMap(), [ring, sewer], { random: mulberry32(1) });

    // then
    expect(run).toThrow(/outfall/);
  });

  it.each([
    ['free', SEEDS],
    // seeds that need no second map, since a lattice map that fails is slow
    ['lattice', [2, 3, 5, 6, 7]],
  ] as const)(
    'leaves no corner where a %s corridor touches the sewer diagonally',
    (placement, seeds) => {
      // given
      const steps = () =>
        [
          digSewers(),
          placeScatteredRooms({ placement }),
          digCorridors({ placement }),
        ] as const;

      // when
      const grids = seeds.map(
        (seed) =>
          pipeline(
            emptyMap({ width: 71, height: 41, tile: Tile.Wall }),
            steps(),
            { random: mulberry32(seed) },
          ).grid,
      );

      // then
      for (const grid of grids) {
        expect(diagonalJumps(grid)).toEqual([]);
      }
    },
  );

  it('leaves no corner where a vein touches the sewer diagonally', () => {
    // given
    const steps = () =>
      [digSewers(), placeScatteredRooms(), digVeins()] as const;

    // when
    const grids = SEEDS.map(
      (seed) => pipeline(wallMap(), steps(), { random: mulberry32(seed) }).grid,
    );

    // then
    for (const grid of grids) {
      expect(diagonalJumps(grid)).toEqual([]);
    }
  });

  it('makes as many cisterns as asked where they fit, and none by default', () => {
    // given
    const count = (options: DigSewersOptions) =>
      SEEDS.map(
        (seed) =>
          dig(options, seed).rooms.filter(({ kind }) => kind === 'cistern')
            .length,
      );

    // when
    const [asked, byDefault] = [
      count({ cisterns: { min: 2, max: 2 } }),
      count({}),
    ];

    // then
    expect(asked.every((cisterns) => cisterns <= 2)).toBe(true);
    expect(asked.reduce((sum, cisterns) => sum + cisterns, 0)).toBeGreaterThan(
      SEEDS.length * 1.5,
    );
    expect(byDefault.every((cisterns) => cisterns === 0)).toBe(true);
  });

  it('fills a cistern with water, ledges on its edges and columns standing in the water', () => {
    // given
    const results = SEEDS.map((seed) =>
      dig({ cisterns: { min: 2, max: 3 }, columnChance: 1 }, seed),
    );

    // when
    const cisterns = results.flatMap(({ grid, rooms }) =>
      rooms
        .filter(({ kind }) => kind === 'cistern')
        .map((room) => ({ grid, room })),
    );

    // then
    expect(cisterns.length).toBeGreaterThan(0);
    for (const { grid, room } of cisterns) {
      const onEdge = ({ x, y }: Point) =>
        x === room.x ||
        y === room.y ||
        x === room.x + room.width - 1 ||
        y === room.y + room.height - 1;
      for (let y = room.y; y < room.y + room.height; ++y) {
        for (let x = room.x; x < room.x + room.width; ++x) {
          const tile = grid.get(x, y);
          if (tile === Tile.Floor) {
            expect(onEdge({ x, y })).toBe(true);
          } else if (tile === Tile.Wall) {
            for (let dy = -1; dy <= 1; ++dy) {
              for (let dx = -1; dx <= 1; ++dx) {
                const near = { x: x + dx, y: y + dy };
                expect(dx === 0 && dy === 0 ? true : isWater(grid, near)).toBe(
                  true,
                );
              }
            }
          } else {
            expect([Tile.ShallowWater, Tile.Bridge]).toContain(tile);
          }
        }
      }
    }
    expect(
      cisterns.some(({ grid, room }) =>
        tilesOf(grid, Tile.Wall).some(
          ({ x, y }) =>
            x > room.x &&
            y > room.y &&
            x < room.x + room.width - 1 &&
            y < room.y + room.height - 1,
        ),
      ),
    ).toBe(true);
  });

  it('stands no column in a cistern without the column chance', () => {
    // given
    const results = SEEDS.map((seed) =>
      dig({ cisterns: { min: 2, max: 3 }, columnChance: 0 }, seed),
    );

    // when
    const walled = results.flatMap(({ grid, rooms }) =>
      rooms
        .filter(({ kind }) => kind === 'cistern')
        .flatMap((room) =>
          tilesOf(grid, Tile.Wall).filter(
            ({ x, y }) =>
              x >= room.x &&
              y >= room.y &&
              x < room.x + room.width &&
              y < room.y + room.height,
          ),
        ),
    );

    // then
    expect(walled).toEqual([]);
  });

  it('runs a branch into its head cistern, at a mouth with no wall under the ledge', () => {
    // given
    const results = SEEDS.map((seed) =>
      dig({ cisterns: { min: 3, max: 3 } }, seed),
    );

    // when
    const atCisterns = results.flatMap((result) => {
      const roomMap = createRoomMap(result);
      return result.sewers.flatMap(({ mouths }) =>
        mouths
          .filter(
            ({ position }) =>
              result.rooms[
                roomMap[position.y * result.grid.width + position.x] ?? -1
              ]?.kind === 'cistern',
          )
          .map((mouth) => ({ grid: result.grid, mouth })),
      );
    });

    // then
    expect(atCisterns.length).toBeGreaterThan(0);
    for (const { grid, mouth } of atCisterns) {
      expect(mouth.wall).toBeUndefined();
      expect(grid.get(mouth.position.x, mouth.position.y)).toBe(Tile.Bridge);
    }
  });

  it('joins every walkway and ledge without wading, with cisterns', () => {
    // given
    const results = SEEDS.map((seed) =>
      dig(
        {
          branches: { min: 6, max: 8 },
          cisterns: { min: 3, max: 4 },
          cisternLedges: { min: 1, max: 1 },
        },
        seed,
      ),
    );

    // when
    const walkways = results.map(({ grid }) =>
      tilesOf(grid, Tile.Floor, Tile.Bridge),
    );

    // then
    results.forEach(({ grid }, index) => {
      const tiles = walkways[index] as Point[];
      expect(reached(grid, tiles)).toBe(tiles.length);
    });
  });

  it('gives every tile of the sewer to a room of its group, cisterns included, but the columns', () => {
    // given
    const results = SEEDS.map((seed) =>
      dig({ cisterns: { min: 2, max: 3 }, columnChance: 1 }, seed),
    );

    // when
    const owners = results.map((result) => createRoomMap(result));

    // then
    results.forEach(({ grid }, index) => {
      const roomMap = owners[index] as Int32Array;
      const sewer = tilesOf(grid, Tile.Floor, Tile.ShallowWater, Tile.Bridge);
      expect(
        sewer.every(({ x, y }) => (roomMap[y * grid.width + x] ?? -1) >= 0),
      ).toBe(true);
      expect(
        tilesOf(grid, Tile.Wall).every(
          ({ x, y }) => (roomMap[y * grid.width + x] ?? -1) === -1,
        ),
      ).toBe(true);
    });
  });

  it('is joined by digCorridors on its walkways and ledges, never at its water, with cisterns', () => {
    // given
    const steps = () =>
      [
        digSewers({ cisterns: { min: 2, max: 3 } }),
        placeScatteredRooms(),
        digCorridors(),
      ] as const;

    // when
    const results = SEEDS.map((seed) =>
      pipeline(wallMap(), steps(), { random: mulberry32(seed) }),
    );

    // then
    for (const result of results) {
      const walkable = tilesOf(result.grid, Tile.Floor, Tile.Door, Tile.Bridge);
      expect(floorIntoWater(result)).toEqual([]);
      expect(reached(result.grid, walkable)).toBe(walkable.length);
      expect(diagonalJumps(result.grid)).toEqual([]);
    }
  });

  it('throws a RangeError for a bad option', () => {
    // given
    const bad: DigSewersOptions[] = [
      { trunkWidth: { min: 0, max: 2 } },
      { branchWidth: { min: 2, max: 1 } },
      { branches: { min: -1, max: 2 } },
      { branchLength: { min: 0, max: 3 } },
      { chamberSize: { min: 1.5, max: 3 } },
      { headChance: 2 },
      { bridgeChance: -0.5 },
      { orientation: 'diagonal' as 'any' },
      { count: { min: -1, max: 1 } },
      { outfalls: { min: 0, max: 3 } },
      { cisterns: { min: -1, max: 1 } },
      { cisternSize: { min: 0, max: 5 } },
      { cisternLedges: { min: 0, max: 2 } },
      { cisternLedges: { min: 1, max: 5 } },
      { columnChance: 1.5 },
      { columnSpacing: { min: 0, max: 2 } },
    ];

    // when
    const attempts = bad.map((options) => () => digSewers(options));

    // then
    for (const attempt of attempts) {
      expect(attempt).toThrow(RangeError);
    }
  });

  it('refuses an area too small for a trunk before the first attempt', () => {
    // given
    const options = {
      orientation: 'horizontal' as const,
      area: { width: { min: 9, max: 20 }, height: { min: 10, max: 10 } },
    };

    // when
    const run = () => pipeline(wallMap(), [digSewers(options)]);

    // then
    expect(run).toThrow(RangeError);
  });

  it('refuses a map that does not start as wall', () => {
    // given
    const base = emptyMap({ width: 40, height: 30, tile: Tile.Floor });

    // when
    const run = () => pipeline(base, [digSewers()]);

    // then
    expect(run).toThrow(RangeError);
  });
});
