import { describe, expect, it } from 'vitest';
import type { Area } from '../core/area';
import { DIRECTIONS } from '../core/directions';
import type { LayoutSymmetry } from '../core/layout-symmetry';
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
import type { CatacombGroup } from '../rooms/catacomb-group';
import type { Exit } from '../rooms/exit';
import type { Room } from '../rooms/room';
import type { RoomShape } from '../rooms/room-shape';
import type { RoomTemplate } from '../rooms/templates/room-template';
import { TemplateCell } from '../rooms/templates/template-cell';
import { TemplatePlacementError } from '../rooms/templates/template-placement-error';
import { catacombsOf } from '../test-helpers/catacombs-of';
import { diagonalJumps } from '../test-helpers/dungeon-checks';
import { mulberry32 } from '../test-helpers/mulberry32';
import { digVeins } from '../veins/dig-veins';
import { digCatacombs } from './dig-catacombs';
import type { DigCatacombsOptions } from './dig-catacombs-options';

const SEEDS = Array.from({ length: 20 }, (_, i) => i + 1);

const wallMap = () => emptyMap({ width: 71, height: 35, tile: Tile.Wall });

/** No tiles, for a missing segment. */
const AREA_NONE = { x: 0, y: 0, width: 0, height: 0 };

/** An area of 36 by 24, room for rooms round it. */
const AREA = { width: { min: 36, max: 36 }, height: { min: 24, max: 24 } };

/** Runs the step alone on a wall map of 71 by 35. */
function dig(options: DigCatacombsOptions = {}, seed = 1) {
  const result = pipeline(wallMap(), [digCatacombs(options)], {
    random: mulberry32(seed),
  });
  return {
    ...result,
    catacomb: catacombsOf(result.roomGroups)[0] as CatacombGroup,
  };
}

/** The tiles of a box that differ from their image under a symmetry about its middle. */
function asymmetricTiles(
  grid: Grid,
  box: Area,
  symmetry: LayoutSymmetry,
): Point[] {
  const flips: [boolean, boolean][] =
    symmetry === 'both'
      ? [
          [true, false],
          [false, true],
        ]
      : [
          [
            symmetry === 'horizontal' || symmetry === 'rotational',
            symmetry === 'vertical' || symmetry === 'rotational',
          ],
        ];
  return tilesIn(box).filter(({ x, y }) =>
    flips.some(
      ([flipX, flipY]) =>
        grid.get(x, y) !==
        grid.get(
          flipX ? 2 * box.x + box.width - 1 - x : x,
          flipY ? 2 * box.y + box.height - 1 - y : y,
        ),
    ),
  );
}

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

/** Every tile of a box. */
function tilesIn({ x, y, width, height }: Area): Point[] {
  return Array.from({ length: width * height }, (_, at) => ({
    x: x + (at % width),
    y: y + Math.floor(at / width),
  }));
}

/** The smallest box that holds the tiles. */
function boundsOf(tiles: readonly Point[]): Area {
  const xs = tiles.map(({ x }) => x);
  const ys = tiles.map(({ y }) => y);
  const [x, y] = [Math.min(...xs), Math.min(...ys)];
  return {
    x,
    y,
    width: Math.max(...xs) - x + 1,
    height: Math.max(...ys) - y + 1,
  };
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

/** The floor tiles with exactly one floor tile next to them. */
function deadEnds(grid: Grid): Point[] {
  return tilesOf(grid, Tile.Floor).filter(
    (tile) =>
      neighbors(tile).filter(({ x, y }) => grid.get(x, y) === Tile.Floor)
        .length === 1,
  );
}

/** How many independent loops the floor makes, as a graph of tiles joined along edges, when it is in one piece. */
function loops(grid: Grid): number {
  const floor = tilesOf(grid, Tile.Floor);
  const links =
    floor.filter(({ x, y }) => grid.get(x + 1, y) === Tile.Floor).length +
    floor.filter(({ x, y }) => grid.get(x, y + 1) === Tile.Floor).length;
  return links - floor.length + 1;
}

const key = ({ x, y }: Point) => `${String(x)},${String(y)}`;

/** What a catacomb dug alone gives the tests. */
interface Dug {
  grid: Grid;
  catacomb: CatacombGroup;
  rooms: Room[];
  roomShapes: RoomShape[];
}

/** The burial chambers of a catacomb, as rooms. */
function chamberRooms({ catacomb, rooms }: Dug): Room[] {
  return catacomb.chambers.map(({ room }) => rooms[room] as Room);
}

/** Every tile of the shapes of the chambers, their walls included. */
function chamberShapeTiles({ catacomb, roomShapes }: Dug): Point[] {
  return catacomb.chambers.flatMap(({ room }) => {
    const shape = roomShapes[room] as RoomShape;
    return shape.cells.flatMap((row, dy) =>
      row.flatMap((cell, dx) =>
        cell === TemplateCell.Unused
          ? []
          : [{ x: shape.x + dx, y: shape.y + dy }],
      ),
    );
  });
}

/** The floor of the galleries, every floor tile but the niches and the chambers. */
function galleryFloor(dug: Dug): Point[] {
  const other = new Set(
    [
      ...dug.catacomb.niches.flatMap(({ tiles }) => tiles),
      ...chamberRooms(dug).flatMap(tilesIn),
    ].map(key),
  );
  return tilesOf(dug.grid, Tile.Floor).filter((tile) => !other.has(key(tile)));
}

/** The tiles of the niches and every tile next to them, even corner to corner. */
function nicheSurroundings(catacomb: CatacombGroup): Point[] {
  return catacomb.niches
    .flatMap(({ tiles }) => tiles)
    .flatMap(({ x, y }) =>
      tilesIn({ x: x - 1, y: y - 1, width: 3, height: 3 }),
    );
}

/** Segments whose walls stay bare, for the tests of the lattice alone. */
const BARE = { bare: 1 };

/**
 * The tiles in the box of the galleries, round a niche or in the shape of a
 * chamber, that differ from the catacomb dug alone from the same seed, which
 * the later steps changed.
 * The catacomb is dug first, so the same seed digs the same one, on its first
 * attempt.
 */
function changedGalleries(grid: Grid, seed: number): Point[] {
  const alone = dig({ area: AREA }, seed);
  return [
    ...tilesIn(boundsOf(galleryFloor(alone))),
    ...nicheSurroundings(alone.catacomb),
    ...chamberShapeTiles(alone),
  ].filter(({ x, y }) => grid.get(x, y) !== alone.grid.get(x, y));
}

const { Wall: W, Floor: F, Door: D, Exit: E, OptionalExit: O } = TemplateCell;

/** A crypt of 5 by 3 with a door in its right wall, in any rotation. */
const CRYPT: RoomTemplate = {
  name: 'crypt',
  cells: [
    [W, W, W, W, W, W, W],
    [W, F, F, F, F, F, W],
    [W, F, F, F, F, F, D],
    [W, F, F, F, F, F, W],
    [W, W, W, W, W, W, W],
  ],
  rotate: [0, 90, 180, 270],
};

/** The tiles of a shape that are not `Unused`, with their cells. */
function cellsOf(shape: RoomShape): (Point & { cell: TemplateCell })[] {
  return shape.cells.flatMap((row, dy) =>
    row.flatMap((cell, dx) =>
      cell === TemplateCell.Unused
        ? []
        : [{ x: shape.x + dx, y: shape.y + dy, cell }],
    ),
  );
}

describe('digCatacombs', () => {
  it('digs the same catacomb from the same seed', () => {
    // given
    const make = () => dig({}, 7);

    // when
    const [first, second] = [make(), make()];

    // then
    expect(first.grid.toString()).toBe(second.grid.toString());
    expect(first.roomGroups).toEqual(second.roomGroups);
  });

  it('digs only floor and doors, in one piece', () => {
    // given
    const results = SEEDS.map((seed) => dig({}, seed));

    // when
    const floors = results.map(({ grid }) =>
      tilesOf(grid, Tile.Floor, Tile.Door),
    );

    // then
    results.forEach(({ grid }, index) => {
      const floor = floors[index] ?? [];
      expect(floor.length).toBeGreaterThan(0);
      expect(floor.length + tilesOf(grid, Tile.Wall).length).toBe(
        grid.width * grid.height,
      );
      expect(reached(grid, floor)).toBe(floor.length);
    });
  });

  it('makes a catacomb group with the area it was dug in', () => {
    // given
    const options = { area: AREA };

    // when
    const results = SEEDS.slice(0, 5).map((seed) => dig(options, seed));

    // then
    for (const { roomGroups, catacomb } of results) {
      expect(roomGroups).toHaveLength(1);
      expect(catacomb.area.width).toBe(36);
      expect(catacomb.area.height).toBe(24);
    }
  });

  it('digs inside its area, within the ring of wall', () => {
    // given
    const options = { area: AREA };

    // when
    const results = SEEDS.map((seed) => dig(options, seed));

    // then
    for (const { grid, catacomb } of results) {
      const { x, y, width, height } = catacomb.area;
      for (const tile of tilesOf(grid, Tile.Floor, Tile.Door)) {
        expect(tile.x).toBeGreaterThan(x);
        expect(tile.y).toBeGreaterThan(y);
        expect(tile.x).toBeLessThan(x + width - 1);
        expect(tile.y).toBeLessThan(y + height - 1);
      }
    }
  });

  it('lists straight segments of floor that never overlap', () => {
    // given
    const results = SEEDS.map((seed) => dig({}, seed));

    // when
    const segmentTiles = results.map(({ catacomb }) =>
      catacomb.segments.flatMap(({ floor }) => tilesIn(floor)),
    );

    // then
    results.forEach(({ grid, catacomb }, index) => {
      const tiles = segmentTiles[index] ?? [];
      expect(tiles.every(({ x, y }) => grid.get(x, y) === Tile.Floor)).toBe(
        true,
      );
      expect(
        new Set(tiles.map(({ x, y }) => `${String(x)},${String(y)}`)).size,
      ).toBe(tiles.length);
      for (const { floor, orientation, width } of catacomb.segments) {
        expect(orientation === 'horizontal' ? floor.height : floor.width).toBe(
          width,
        );
      }
    });
  });

  it('ends every segment at a junction, a turn or a dead end, never where the gallery runs straight on', () => {
    // given
    const results = SEEDS.map((seed) =>
      dig({ mainGalleries: { min: 0, max: 0 } }, seed),
    );

    // when
    const ends = results.map(({ catacomb }) =>
      catacomb.segments.flatMap(({ floor, orientation }) =>
        orientation === 'horizontal'
          ? [
              { x: floor.x - 1, y: floor.y },
              { x: floor.x + floor.width, y: floor.y },
            ]
          : [
              { x: floor.x, y: floor.y - 1 },
              { x: floor.x, y: floor.y + floor.height },
            ],
      ),
    );

    // then
    results.forEach(({ grid }, index) => {
      for (const end of ends[index] ?? []) {
        const open = neighbors(end).filter(
          ({ x, y }) => grid.get(x, y) === Tile.Floor,
        );
        const straight =
          open.length === 2 &&
          (open[0]?.x === open[1]?.x || open[0]?.y === open[1]?.y);
        expect(straight).toBe(false);
      }
    });
  });

  it('makes main galleries as wide as asked, and side galleries as narrow', () => {
    // given
    const options = {
      mainGalleries: { min: 1, max: 1 },
      mainWidth: { min: 3, max: 3 },
      sideWidth: { min: 1, max: 1 },
    };

    // when
    const results = SEEDS.map((seed) => dig(options, seed));

    // then
    for (const { catacomb } of results) {
      expect(catacomb.segments.some(({ main }) => main)).toBe(true);
      for (const { main, width } of catacomb.segments) {
        expect(width).toBe(main ? 3 : 1);
      }
    }
  });

  it('makes no main gallery when asked for none', () => {
    // given
    const options = { mainGalleries: { min: 0, max: 0 } };

    // when
    const results = SEEDS.map((seed) => dig(options, seed));

    // then
    for (const { catacomb } of results) {
      expect(catacomb.segments.some(({ main }) => main)).toBe(false);
    }
  });

  it('keeps the rock between galleries side by side within the spacing', () => {
    // given
    const options = {
      mainGalleries: { min: 0, max: 0 },
      spacing: { min: 2, max: 3 },
      loopChance: 1,
      segments: BARE,
    };

    // when
    const results = SEEDS.map((seed) => dig(options, seed));

    // then
    for (const { catacomb } of results) {
      for (const { floor, orientation } of catacomb.segments) {
        const length =
          orientation === 'horizontal' ? floor.width : floor.height;
        expect(length).toBeGreaterThanOrEqual(2);
        expect(length).toBeLessThanOrEqual(3);
      }
    }
  });

  it('leaves no dead end without the dead end chance', () => {
    // given
    const options = {
      mainGalleries: { min: 0, max: 0 },
      loopChance: 0,
      deadEndChance: 0,
      segments: BARE,
    };

    // when
    const grids = SEEDS.map((seed) => dig(options, seed).grid);

    // then
    for (const grid of grids) {
      expect(deadEnds(grid)).toEqual([]);
    }
  });

  it('makes a tree with no loop chance, keeping every dead end', () => {
    // given
    const options = {
      mainGalleries: { min: 0, max: 0 },
      loopChance: 0,
      deadEndChance: 1,
      segments: BARE,
    };

    // when
    const grids = SEEDS.map((seed) => dig(options, seed).grid);

    // then
    for (const grid of grids) {
      expect(loops(grid)).toBe(0);
      expect(deadEnds(grid).length).toBeGreaterThan(0);
    }
  });

  it('makes more loops with a higher loop chance', () => {
    // given
    const options = (loopChance: number) => ({
      mainGalleries: { min: 0, max: 0 },
      loopChance,
    });

    // when
    const [few, many] = [0.1, 0.9].map((chance) =>
      SEEDS.reduce(
        (sum, seed) => sum + loops(dig(options(chance), seed).grid),
        0,
      ),
    );

    // then
    expect(many).toBeGreaterThan(few ?? 0);
  });

  it('reserves the rock between its galleries, round its niches and its chambers, and leaves the rest free', () => {
    // given
    const options = { area: AREA };

    // when
    const results = SEEDS.map((seed) => dig(options, seed));

    // then
    for (const result of results) {
      const { grid, reserved, catacomb } = result;
      const box = boundsOf(galleryFloor(result));
      const round = new Set(
        [...nicheSurroundings(catacomb), ...chamberShapeTiles(result)].map(key),
      );
      for (const tile of tilesOf(grid, Tile.Wall)) {
        const { x, y } = tile;
        const inside =
          (x >= box.x &&
            y >= box.y &&
            x < box.x + box.width &&
            y < box.y + box.height) ||
          round.has(key(tile));
        expect(reserved[y * grid.width + x]).toBe(
          inside ? Reserve.Solid : Reserve.None,
        );
      }
    }
  });

  it('draws the character of every segment by the weights', () => {
    // given
    const weights = [
      { niches: 1 },
      { bare: 1 },
      { niches: 1, bare: 1 },
      { chambers: 1, bare: 1 },
    ];

    // when
    const characters = weights.map((segments) =>
      SEEDS.flatMap((seed) =>
        dig({ segments }, seed).catacomb.segments.map(
          ({ character }) => character,
        ),
      ),
    );

    // then
    const share = (list: readonly string[] = [], wanted = 'niches') =>
      list.filter((character) => character === wanted).length / list.length;
    expect(share(characters[0])).toBeGreaterThan(0.9);
    expect(share(characters[1])).toBe(0);
    expect(share(characters[1], 'chambers')).toBe(0);
    expect(share(characters[2])).toBeGreaterThan(0.3);
    expect(share(characters[2])).toBeLessThan(0.7);
    expect(share(characters[3], 'chambers')).toBeGreaterThan(0.3);
    expect(share(characters[3], 'chambers')).toBeLessThan(0.7);
  });

  it('gives niches to the segments of that character only, and at least one each', () => {
    // given
    const results = SEEDS.map((seed) => dig({}, seed));

    // when
    const counts = results.map(({ catacomb }) =>
      catacomb.segments.map(
        (_, index) =>
          catacomb.niches.filter(
            ({ segment, chamber }) =>
              segment === index && chamber === undefined,
          ).length,
      ),
    );

    // then
    results.forEach(({ catacomb }, index) => {
      catacomb.segments.forEach(({ character }, segment) => {
        const count = counts[index]?.[segment] ?? 0;
        expect(character === 'niches' ? count > 0 : count === 0).toBe(true);
      });
    });
  });

  it('digs every niche one tile wide, as deep as asked, straight out of the wall of its segment', () => {
    // given
    const options = { nicheDepth: { min: 1, max: 3 } };

    // when
    const results = SEEDS.map((seed) => dig(options, seed));

    // then
    const out = {
      top: { x: 0, y: -1 },
      right: { x: 1, y: 0 },
      bottom: { x: 0, y: 1 },
      left: { x: -1, y: 0 },
    };
    for (const { grid, catacomb } of results) {
      for (const { tiles, side, segment } of catacomb.niches.filter(
        ({ chamber }) => chamber === undefined,
      )) {
        const { floor, orientation } = catacomb.segments[segment] ?? {};
        expect(orientation).toBe(
          side === 'top' || side === 'bottom' ? 'horizontal' : 'vertical',
        );
        expect(tiles.length).toBeGreaterThanOrEqual(1);
        expect(tiles.length).toBeLessThanOrEqual(3);
        const [mouth] = tiles as [Point];
        const inner = {
          x: mouth.x - out[side].x,
          y: mouth.y - out[side].y,
        };
        expect(
          tilesIn(floor ?? AREA_NONE).some((tile) => key(tile) === key(inner)),
        ).toBe(true);
        tiles.forEach((tile, step) => {
          expect(tile).toEqual({
            x: mouth.x + step * out[side].x,
            y: mouth.y + step * out[side].y,
          });
          expect(grid.get(tile.x, tile.y)).toBe(Tile.Floor);
        });
      }
    }
  });

  it('keeps every niche apart from all floor but its own gallery or chamber, even corner to corner', () => {
    // given
    const results = SEEDS.map((seed) => dig({}, seed));

    // when
    const touching = results.flatMap((result) => {
      const { grid, catacomb } = result;
      const galleries = new Set(galleryFloor(result).map(key));
      const chambers = chamberRooms(result).map(
        (room) => new Set(tilesIn(room).map(key)),
      );
      return catacomb.niches.flatMap(({ tiles, chamber }) => {
        const gallery =
          chamber === undefined
            ? galleries
            : (chambers[chamber] as Set<string>);
        const own = new Set(tiles.map(key));
        const [mouth] = tiles as [Point];
        return tiles
          .flatMap(({ x, y }) =>
            tilesIn({ x: x - 1, y: y - 1, width: 3, height: 3 }),
          )
          .filter(
            (tile) =>
              !own.has(key(tile)) &&
              grid.get(tile.x, tile.y) === Tile.Floor &&
              // its gallery or chamber, beside its mouth
              !(
                gallery.has(key(tile)) &&
                Math.abs(tile.x - mouth.x) <= 1 &&
                Math.abs(tile.y - mouth.y) <= 1
              ),
          );
      });
    });

    // then
    expect(touching).toEqual([]);
  });

  it('spaces the niches along a wall as asked', () => {
    // given
    const options = { nicheSpacing: { min: 2, max: 2 } };

    // when
    const results = SEEDS.map((seed) => dig(options, seed));

    // then
    for (const { catacomb } of results) {
      catacomb.segments.forEach(({ orientation }, segment) => {
        for (const wall of ['top', 'right', 'bottom', 'left'] as const) {
          const along = catacomb.niches
            .filter(
              ({ segment: of, side, chamber }) =>
                of === segment && side === wall && chamber === undefined,
            )
            .map(({ tiles }) =>
              orientation === 'horizontal'
                ? (tiles[0] as Point).x
                : (tiles[0] as Point).y,
            );
          for (let index = 1; index < along.length; ++index) {
            expect(((along[index] ?? 0) - (along[index - 1] ?? 0)) % 3).toBe(0);
          }
        }
      });
    }
  });

  it('lines one side of a segment or both, as asked', () => {
    // given
    const sides = [
      { min: 1, max: 1 },
      { min: 2, max: 2 },
    ];

    // when
    const counts = sides.map((nicheSides) =>
      SEEDS.flatMap((seed) => {
        const { catacomb } = dig({ nicheSides, segments: { niches: 1 } }, seed);
        return catacomb.segments.map(
          (_, index) =>
            new Set(
              catacomb.niches
                .filter(
                  ({ segment, chamber }) =>
                    segment === index && chamber === undefined,
                )
                .map(({ side }) => side),
            ).size,
        );
      }),
    );

    // then
    expect(counts[0]?.every((count) => count <= 1)).toBe(true);
    const both = counts[1]?.filter((count) => count === 2).length ?? 0;
    // where the niches of two galleries would meet, some are left out
    expect(both / (counts[1]?.length ?? 1)).toBeGreaterThan(0.6);
  });

  it('spaces the galleries wider for the niches', () => {
    // given
    const options = (segments: { niches?: number; bare?: number }) => ({
      mainGalleries: { min: 0, max: 0 },
      spacing: { min: 1, max: 1 },
      nicheDepth: { min: 1, max: 2 },
      loopChance: 1,
      segments,
    });

    // when
    const lengths = [{ niches: 1 }, BARE].map((segments) =>
      SEEDS.flatMap((seed) =>
        dig(options(segments), seed).catacomb.segments.map(
          ({ floor, orientation }) =>
            orientation === 'horizontal' ? floor.width : floor.height,
        ),
      ),
    );

    // then
    expect(new Set(lengths[0])).toEqual(new Set([5]));
    expect(new Set(lengths[1])).toEqual(new Set([1]));
  });

  it('makes every chamber a room of its group, with its door as its one exit and its shape', () => {
    // given
    const results = SEEDS.map((seed) => dig({}, seed));

    // when
    const chambers = results.map(chamberRooms);

    // then
    expect(chambers.flat().length).toBeGreaterThan(0);
    results.forEach(({ grid, rooms, roomExits, roomShapes }, index) => {
      expect(rooms.map(({ kind }) => kind)).toEqual(
        rooms.map(() => 'burialChamber'),
      );
      expect(chambers[index]).toEqual(rooms);
      for (const room of rooms) {
        expect(room.group).toBe(0);
        expect(room.exitCount).toBe(1);
        expect(room.doorCount).toBe(1);
        const exit = roomExits[room.exits[0] ?? -1];
        expect(exit?.door).toBe(true);
        expect(exit?.rooms).toEqual([room.id]);
        const { x, y } = exit?.position ?? { x: -1, y: -1 };
        expect(grid.get(x, y)).toBe(Tile.Door);
        expect(roomShapes[room.id]?.doors).toEqual([{ x, y, door: true }]);
        for (const tile of tilesIn(room)) {
          expect(grid.get(tile.x, tile.y)).toBe(Tile.Floor);
        }
      }
    });
  });

  it('opens every chamber onto its gallery through its door alone', () => {
    // given
    const results = SEEDS.map((seed) => dig({}, seed));

    // when
    const touching = results.flatMap((result) => {
      const { grid, catacomb, roomExits } = result;
      return chamberRooms(result).flatMap((room, index) => {
        const door = (roomExits[room.exits[0] ?? -1] as { position: Point })
          .position;
        const own = new Set(
          [
            ...tilesIn(room),
            ...catacomb.niches
              .filter(({ chamber }) => chamber === index)
              .flatMap(({ tiles }) => tiles),
            door,
          ].map(key),
        );
        return tilesIn({
          x: room.x - 1,
          y: room.y - 1,
          width: room.width + 2,
          height: room.height + 2,
        }).filter(
          (tile) =>
            !own.has(key(tile)) && grid.get(tile.x, tile.y) !== Tile.Wall,
        );
      });
    });
    const doorsOpen = results.every((result) =>
      chamberRooms(result).every((room) => {
        const door = (
          result.roomExits[room.exits[0] ?? -1] as { position: Point }
        ).position;
        const open = neighbors(door).filter(
          ({ x, y }) => result.grid.get(x, y) === Tile.Floor,
        );
        return open.length === 2;
      }),
    );

    // then
    expect(touching).toEqual([]);
    expect(doorsOpen).toBe(true);
  });

  it('makes chambers as wide along their gallery and as deep as asked', () => {
    // given
    const options = {
      segments: { chambers: 1 },
      chamberSize: { width: { min: 2, max: 4 }, depth: { min: 2, max: 3 } },
    };

    // when
    const results = SEEDS.map((seed) => dig(options, seed));

    // then
    for (const result of results) {
      chamberRooms(result).forEach((room, index) => {
        const { side } = result.catacomb.chambers[index] ?? {};
        const across = side === 'top' || side === 'bottom';
        const [width, depth] = across
          ? [room.width, room.height]
          : [room.height, room.width];
        expect(width).toBeGreaterThanOrEqual(2);
        expect(width).toBeLessThanOrEqual(4);
        expect(depth).toBeGreaterThanOrEqual(2);
        expect(depth).toBeLessThanOrEqual(3);
      });
    }
  });

  it('gives chambers to the segments of that character only, and at least one each', () => {
    // given
    const results = SEEDS.map((seed) => dig({}, seed));

    // when
    const counts = results.map(({ catacomb }) =>
      catacomb.segments.map(
        (_, index) =>
          catacomb.chambers.filter(
            ({ segment, deadEnd }) => segment === index && !deadEnd,
          ).length,
      ),
    );

    // then
    results.forEach(({ catacomb }, index) => {
      catacomb.segments.forEach(({ character }, segment) => {
        const count = counts[index]?.[segment] ?? 0;
        expect(character === 'chambers' ? count > 0 : count === 0).toBe(true);
      });
    });
  });

  it('puts every chamber beside its segment, its door in the wall', () => {
    // given
    const results = SEEDS.map((seed) => dig({ deadEndChamberChance: 0 }, seed));

    // when
    const doors = results.flatMap((result) =>
      chamberRooms(result).map((room, index) => ({
        chamber: result.catacomb.chambers[index],
        segment:
          result.catacomb.segments[
            result.catacomb.chambers[index]?.segment ?? -1
          ],
        door: (result.roomExits[room.exits[0] ?? -1] as { position: Point })
          .position,
      })),
    );

    // then
    expect(doors.length).toBeGreaterThan(0);
    for (const { chamber, segment, door } of doors) {
      const { x, y, width, height } = segment?.floor ?? AREA_NONE;
      const expected = {
        top: [door.y === y - 1, door.x >= x && door.x < x + width],
        bottom: [door.y === y + height, door.x >= x && door.x < x + width],
        left: [door.x === x - 1, door.y >= y && door.y < y + height],
        right: [door.x === x + width, door.y >= y && door.y < y + height],
      }[chamber?.side ?? 'top'];
      expect(chamber?.deadEnd).toBe(false);
      expect(expected).toEqual([true, true]);
    }
  });

  it('spaces the chambers along a wall as asked', () => {
    // given
    const options = {
      segments: { chambers: 1 },
      chamberSize: { width: { min: 3, max: 3 } },
      chamberSpacing: { min: 2, max: 2 },
      deadEndChamberChance: 0,
    };

    // when
    const results = SEEDS.map((seed) => dig(options, seed));

    // then
    for (const result of results) {
      const { catacomb } = result;
      const rooms = chamberRooms(result);
      catacomb.segments.forEach(({ orientation }, segment) => {
        for (const wall of ['top', 'right', 'bottom', 'left'] as const) {
          const along = rooms
            .filter(
              (_, index) =>
                catacomb.chambers[index]?.segment === segment &&
                catacomb.chambers[index].side === wall,
            )
            .map(({ x, y }) => (orientation === 'horizontal' ? x : y));
          for (let index = 1; index < along.length; ++index) {
            expect(((along[index] ?? 0) - (along[index - 1] ?? 0)) % 5).toBe(0);
          }
        }
      });
    }
  });

  it('puts chambers on one side of a segment or facing each other on both, as asked', () => {
    // given
    const sides = [
      { min: 1, max: 1 },
      { min: 2, max: 2 },
    ];

    // when
    const pairs = sides.map((chamberSides) =>
      SEEDS.flatMap((seed) => {
        const result = dig(
          { chamberSides, segments: { chambers: 1 }, deadEndChamberChance: 0 },
          seed,
        );
        const rooms = chamberRooms(result);
        return result.catacomb.segments.map((segment, index) => {
          const along = (side: string) =>
            rooms
              .filter(
                (_, at) =>
                  result.catacomb.chambers[at]?.segment === index &&
                  result.catacomb.chambers[at].side === side,
              )
              .map(({ x, y }) =>
                segment.orientation === 'horizontal' ? x : y,
              );
          const [first, second] =
            segment.orientation === 'horizontal'
              ? [along('top'), along('bottom')]
              : [along('left'), along('right')];
          return first.filter((position) => second.includes(position)).length;
        });
      }),
    );

    // then
    expect(pairs[0]?.every((count) => count === 0)).toBe(true);
    expect(pairs[1]?.some((count) => count > 0)).toBe(true);
  });

  it('gives a segment niches when no chamber fits, and leaves it bare when no niche does', () => {
    // given
    const options = {
      segments: { chambers: 1 },
      chamberSize: { width: { min: 40, max: 40 } },
      deadEndChamberChance: 0,
    };

    // when
    const results = SEEDS.map((seed) => dig(options, seed));

    // then
    const characters = results.flatMap(({ catacomb }) =>
      catacomb.segments.map(({ character }) => character),
    );
    expect(characters).toContain('niches');
    expect(characters).not.toContain('chambers');
    for (const { catacomb } of results) {
      expect(catacomb.chambers).toEqual([]);
    }
  });

  it('closes dead ends with chambers by their chance, the door in the end wall', () => {
    // given
    const options = (deadEndChamberChance: number) => ({
      mainGalleries: { min: 0, max: 0 },
      loopChance: 0,
      deadEndChance: 1,
      // the room for chambers beyond the dead ends, and none beside the galleries
      segments: { chambers: 1 },
      chamberSides: { min: 1, max: 1 },
      deadEndChamberChance,
    });

    // when
    const [none, all] = [0, 1].map((chance) =>
      SEEDS.map((seed) => dig(options(chance), seed)),
    );

    // then
    for (const { catacomb } of none ?? []) {
      expect(catacomb.chambers.filter(({ deadEnd }) => deadEnd)).toEqual([]);
    }
    const closed = (all ?? []).flatMap((result) =>
      chamberRooms(result).flatMap((room, index) =>
        result.catacomb.chambers[index]?.deadEnd
          ? [
              {
                chamber: result.catacomb.chambers[index],
                door: (
                  result.roomExits[room.exits[0] ?? -1] as { position: Point }
                ).position,
                grid: result.grid,
              },
            ]
          : [],
      ),
    );
    expect(closed.length).toBeGreaterThan(0);
    for (const { chamber, door, grid } of closed) {
      const back = {
        top: { x: 0, y: 1 },
        bottom: { x: 0, y: -1 },
        left: { x: 1, y: 0 },
        right: { x: -1, y: 0 },
      }[chamber.side];
      // the gallery runs on from the door, and ends there
      expect(grid.get(door.x + back.x, door.y + back.y)).toBe(Tile.Floor);
      const beside = [
        { x: door.x + back.y, y: door.y + back.x },
        { x: door.x - back.y, y: door.y - back.x },
      ].map(({ x, y }) => grid.get(x, y));
      expect(beside).toEqual([Tile.Wall, Tile.Wall]);
    }
  });

  it('lines the walls of chambers with niches by their chance, never the wall of the door', () => {
    // given
    const options = (chamberNicheChance: number) => ({
      segments: { chambers: 1 },
      chamberSize: { depth: { min: 3, max: 3 } },
      chamberNicheChance,
    });

    // when
    const [none, all] = [0, 1].map((chance) =>
      SEEDS.map((seed) => dig(options(chance), seed)),
    );

    // then
    for (const { catacomb } of none ?? []) {
      expect(catacomb.niches.some(({ chamber }) => chamber !== undefined)).toBe(
        false,
      );
    }
    const opposite = {
      top: 'bottom',
      bottom: 'top',
      left: 'right',
      right: 'left',
    } as const;
    let inside = 0;
    for (const result of all ?? []) {
      const rooms = chamberRooms(result);
      for (const { tiles, side, chamber, segment } of result.catacomb.niches) {
        if (chamber === undefined) {
          continue;
        }
        ++inside;
        const owner = result.catacomb.chambers[chamber];
        expect(owner?.segment).toBe(segment);
        expect(side).not.toBe(opposite[owner?.side ?? 'top']);
        const room = rooms[chamber] as Room;
        const [mouth] = tiles as [Point];
        const shape = result.roomShapes[room.id] as RoomShape;
        // the mouth is in the chamber's wall, next to its floor
        expect(
          neighbors(mouth).some(
            ({ x, y }) =>
              x >= room.x &&
              y >= room.y &&
              x < room.x + room.width &&
              y < room.y + room.height,
          ),
        ).toBe(true);
        for (const { x, y } of tiles) {
          expect(shape.cells[y - shape.y]?.[x - shape.x]).toBe(
            TemplateCell.Floor,
          );
        }
      }
    }
    expect(inside).toBeGreaterThan(0);
  });

  it('spaces the galleries wider for the chambers', () => {
    // given
    const options = {
      mainGalleries: { min: 0, max: 0 },
      spacing: { min: 1, max: 1 },
      chamberSize: { depth: { min: 2, max: 2 } },
      loopChance: 1,
      segments: { chambers: 1, niches: 1 },
    };

    // when
    const results = SEEDS.map((seed) => dig(options, seed));

    // then
    const lengths = results.flatMap(({ catacomb }) =>
      catacomb.segments.map(({ floor, orientation }) =>
        orientation === 'horizontal' ? floor.width : floor.height,
      ),
    );
    // the spacing and a wall and a chamber on each side
    expect(new Set(lengths)).toEqual(new Set([7]));
  });

  it('places every copy of its templates as crypts, rooms of its group', () => {
    // given
    const options = {
      area: AREA,
      templates: [{ ...CRYPT, count: { min: 2, max: 2 } }],
    };

    // when
    const results = SEEDS.slice(0, 10).map((seed) => dig(options, seed));

    // then
    for (const { catacomb, rooms, roomShapes, roomGroups, grid } of results) {
      expect(catacomb.crypts).toHaveLength(2);
      for (const id of catacomb.crypts) {
        const room = rooms[id] as Room;
        expect(room.kind).toBe('room');
        expect(room.template).toBe(0);
        expect(room.templateName).toBe('crypt');
        expect(room.group).toBe(roomGroups.length - 1);
        for (const { x, y, cell } of cellsOf(roomShapes[id] as RoomShape)) {
          expect(grid.get(x, y)).toBe(
            cell === F ? Tile.Floor : cell === W ? Tile.Wall : Tile.Door,
          );
        }
      }
    }
  });

  it('opens every crypt onto a gallery through its exits, in one piece with the galleries', () => {
    // given
    const options = { area: AREA, templates: [CRYPT] };

    // when
    const results = SEEDS.map((seed) => dig(options, seed));

    // then
    for (const { catacomb, rooms, roomExits, grid } of results) {
      const room = rooms[catacomb.crypts[0] as number] as Room;
      expect(room.exitCount).toBe(1);
      expect(room.doorCount).toBe(1);
      const exit = roomExits[room.exits[0] as number];
      expect(exit?.rooms).toEqual([room.id]);
      expect(exit?.door).toBe(true);
      const walkable = tilesOf(grid, Tile.Floor, Tile.Door);
      expect(reached(grid, walkable)).toBe(walkable.length);
    }
  });

  it('opens a crypt of optional exits where it needs, with doors by the door chance', () => {
    // given
    const open: RoomTemplate = {
      cells: [
        [W, O, O, O, W],
        [O, F, F, F, O],
        [O, F, F, F, O],
        [W, O, O, O, W],
      ],
    };
    const runs = [0, 1].map((doorChance) =>
      SEEDS.slice(0, 10).map((seed) =>
        dig({ area: AREA, templates: [open], doorChance }, seed),
      ),
    );

    // when
    const exits = runs.map((results) =>
      results.flatMap(({ catacomb, rooms, roomExits, grid }) => {
        const room = rooms[catacomb.crypts[0] as number] as Room;
        expect(room.exitCount).toBeGreaterThan(0);
        return room.exits.map((at) => {
          const exit = roomExits[at];
          return (
            exit && {
              door: exit.door,
              tile: grid.get(exit.position.x, exit.position.y),
            }
          );
        });
      }),
    );

    // then
    expect(
      exits[0]?.every(
        (exit) => exit?.door === false && exit.tile === Tile.Floor,
      ),
    ).toBe(true);
    expect(
      exits[1]?.every((exit) => exit?.door === true && exit.tile === Tile.Door),
    ).toBe(true);
  });

  it('gives an exit of a crypt a door by the door chance', () => {
    // given
    const exitCrypt = {
      ...CRYPT,
      cells: CRYPT.cells.map((row) =>
        row.map((cell) => (cell === D ? E : cell)),
      ),
    };
    const runs = [0, 1].map((doorChance) =>
      SEEDS.slice(0, 5).map((seed) =>
        dig({ area: AREA, templates: [exitCrypt], doorChance }, seed),
      ),
    );

    // when
    const doors = runs.map((results) =>
      results.map(
        ({ catacomb, rooms }) =>
          (rooms[catacomb.crypts[0] as number] as Room).doorCount,
      ),
    );

    // then
    expect(doors[0]).toEqual([0, 0, 0, 0, 0]);
    expect(doors[1]).toEqual([1, 1, 1, 1, 1]);
  });

  it('places crypts at their positions, in the coordinates of its area', () => {
    // given
    const options = {
      area: AREA,
      templates: [
        {
          ...CRYPT,
          rotate: undefined,
          positions: [{ coords: { x: 10, y: 9 }, anchor: 'top-left' as const }],
        },
      ],
    };

    // when
    const results = SEEDS.slice(0, 5).map((seed) => dig(options, seed));

    // then
    for (const { catacomb, rooms } of results) {
      const room = rooms[catacomb.crypts[0] as number] as Room;
      expect(room.x - catacomb.area.x).toBe(10);
      expect(room.y - catacomb.area.y).toBe(9);
    }
  });

  it('joins the galleries that a crypt cuts apart through the crypt', () => {
    // given
    const tall = Array.from({ length: 22 }, (_, y) =>
      y === 0 || y === 21 ? [W, W, W] : y === 10 ? [D, F, D] : [W, F, W],
    );
    const options = {
      area: AREA,
      segments: BARE,
      templates: [
        {
          cells: tall,
          positions: [{ coords: { x: 16, y: 1 }, anchor: 'top-left' as const }],
        },
      ],
    };

    // when
    const results = SEEDS.slice(0, 10).map((seed) => dig(options, seed));

    // then
    for (const { catacomb, rooms, grid } of results) {
      const room = rooms[catacomb.crypts[0] as number] as Room;
      expect(room.exitCount).toBe(2);
      const floor = tilesOf(grid, Tile.Floor);
      expect(floor.some(({ x }) => x < room.x)).toBe(true);
      expect(floor.some(({ x }) => x >= room.x + room.width)).toBe(true);
      const walkable = tilesOf(grid, Tile.Floor, Tile.Door);
      expect(reached(grid, walkable)).toBe(walkable.length);
    }
  });

  it('throws a permanent TemplatePlacementError for a crypt bigger than its area', () => {
    // given
    const huge: RoomTemplate = {
      cells: [
        Array.from({ length: 40 }, () => W),
        [W, ...Array.from({ length: 38 }, () => F), D],
        Array.from({ length: 40 }, () => W),
      ],
    };

    // when
    const run = () => dig({ area: AREA, templates: [huge] });

    // then
    expect(run).toThrow(TemplatePlacementError);
  });

  it.each([
    [1, 0, Tile.Door],
    [0, 1, Tile.Floor],
  ])(
    'gives an optional exit of a template placed before the door its step decided (%i), whatever its own chance (%i)',
    (placedChance, ownChance, tile) => {
      // given
      const optional: RoomTemplate = {
        cells: [
          [W, O, W],
          [O, F, O],
          [W, O, W],
        ],
      };
      const steps = () =>
        [
          placeScatteredRooms({
            roomCount: { min: 1, max: 1 },
            templates: [optional],
            doorChance: placedChance,
          }),
          digCatacombs({ doorChance: ownChance }),
        ] as const;

      // when
      const tiles = SEEDS.slice(0, 10).flatMap((seed) => {
        const { rooms, roomExits, grid } = pipeline(wallMap(), steps(), {
          random: mulberry32(seed),
        });
        const room = rooms.find(({ template }) => template !== undefined);
        return (room?.exits ?? []).map((at) => {
          const { x, y } = (roomExits[at] as Exit).position;
          return grid.get(x, y);
        });
      });

      // then
      expect(tiles).not.toHaveLength(0);
      expect(tiles.every((opened) => opened === tile)).toBe(true);
    },
  );

  it('enters the rooms placed before on the whole map through their optional exits', () => {
    // given
    const steps = () =>
      [
        placeScatteredRooms({ roomCount: { min: 3, max: 5 } }),
        digCatacombs(),
      ] as const;

    // when
    const results = SEEDS.map((seed) =>
      pipeline(wallMap(), steps(), { random: mulberry32(seed) }),
    );

    // then
    let entered = 0;
    for (const { rooms, roomShapes, roomExits, grid } of results) {
      const placed = rooms.filter(({ group }) => group === undefined);
      entered += placed.filter(({ exitCount }) => exitCount > 0).length;
      for (const room of placed) {
        const shape = roomShapes[room.id] as RoomShape;
        expect(room.exits).toHaveLength(room.exitCount);
        for (const at of room.exits) {
          const exit = roomExits[at];
          expect(exit?.rooms).toEqual([room.id]);
          const wall = cellsOf(shape).find(
            ({ x, y }) => x === exit?.position.x && y === exit.position.y,
          );
          expect(wall?.cell).toBe(O);
        }
      }
      // the rooms left shut are apart, and everything else is one piece
      const shut = new Set(
        placed
          .filter(({ exitCount }) => exitCount === 0)
          .flatMap(tilesIn)
          .map(key),
      );
      const walkable = tilesOf(grid, Tile.Floor, Tile.Door).filter(
        (tile) => !shut.has(key(tile)),
      );
      expect(reached(grid, walkable)).toBe(walkable.length);
    }
    expect(entered).toBeGreaterThan(SEEDS.length);
  });

  it('mirrors the whole catacomb by its symmetry, at a symmetry chance of 1', () => {
    // given
    const symmetries: LayoutSymmetry[] = [
      'horizontal',
      'vertical',
      'both',
      'rotational',
    ];

    // when
    const results = symmetries.flatMap((symmetry) =>
      SEEDS.slice(0, 10).map((seed) => ({
        symmetry,
        ...dig({ symmetry }, seed),
      })),
    );

    // then
    for (const { symmetry, grid, catacomb } of results) {
      expect(catacomb.niches.length).toBeGreaterThan(0);
      expect(asymmetricTiles(grid, catacomb.area, symmetry)).toEqual([]);
    }
  });

  it('mirrors about the middle of its area', () => {
    // given
    const options = { area: AREA, symmetry: 'both' as const };

    // when
    const results = SEEDS.slice(0, 10).map((seed) => dig(options, seed));

    // then
    for (const { grid, catacomb } of results) {
      expect(catacomb.area.width).toBe(36);
      expect(asymmetricTiles(grid, catacomb.area, 'both')).toEqual([]);
    }
  });

  it('mirrors the galleries but not always the niches and chambers below a symmetry chance of 1', () => {
    // given
    const options = { symmetry: 'horizontal' as const, symmetryChance: 0 };

    // when
    const results = SEEDS.slice(0, 10).map((seed) => dig(options, seed));

    // then
    for (const result of results) {
      const floor = galleryFloor(result);
      const mirrored = new Set(
        floor.map(({ x, y }) => key({ x: result.grid.width - 1 - x, y })),
      );
      expect(floor.filter((tile) => !mirrored.has(key(tile)))).toEqual([]);
    }
    expect(
      results.some(
        ({ grid, catacomb }) =>
          asymmetricTiles(grid, catacomb.area, 'horizontal').length > 0,
      ),
    ).toBe(true);
  });

  it('mirrors the crypts with templateSymmetry, and their passages', () => {
    // given
    const options = {
      symmetry: 'horizontal' as const,
      templates: [CRYPT],
      templateSymmetry: true,
    };

    // when
    const results = SEEDS.slice(0, 10).map((seed) => dig(options, seed));

    // then
    for (const { grid, catacomb, rooms } of results) {
      const boxes = catacomb.crypts.map((id) => rooms[id] as Room);
      expect(boxes).toHaveLength(2);
      const [first, second] = boxes as [Room, Room];
      expect(second.x).toBe(grid.width - first.x - first.width);
      expect(second.y).toBe(first.y);
      expect(second.mirrored).toBe(!first.mirrored);
      expect(asymmetricTiles(grid, catacomb.area, 'horizontal')).toEqual([]);
    }
  });

  it('keeps off reserved tiles', () => {
    // given
    const block = { x: 25, y: 10, width: 20, height: 14 };
    const reserve = step('reserveBlock', {}, (state) => {
      for (const { x, y } of tilesIn(block)) {
        reserveTile(state, x, y, Reserve.Solid);
      }
      return {};
    });

    // when
    const grids = SEEDS.map(
      (seed) =>
        pipeline(wallMap(), [reserve, digCatacombs()], {
          random: mulberry32(seed),
        }).grid,
    );

    // then
    for (const grid of grids) {
      for (const { x, y } of tilesIn(block)) {
        expect(grid.get(x, y)).toBe(Tile.Wall);
      }
    }
  });

  it('is joined by digCorridors on its boundary, never through its rock', () => {
    // given
    const steps = () =>
      [
        digCatacombs({ area: AREA }),
        placeScatteredRooms(),
        digCorridors(),
      ] as const;

    // when
    const results = SEEDS.map((seed) =>
      pipeline(wallMap(), steps(), { random: mulberry32(seed) }),
    );

    // then
    results.forEach(({ grid, rooms }, index) => {
      const walkable = tilesOf(grid, Tile.Floor, Tile.Door);
      expect(reached(grid, walkable)).toBe(walkable.length);
      expect(changedGalleries(grid, SEEDS[index] ?? 0)).toEqual([]);
      for (const room of rooms.filter(({ kind }) => kind === 'burialChamber')) {
        expect(room.exitCount).toBe(1);
      }
    });
  });

  it('is joined by digVeins on its boundary, never through its rock', () => {
    // given
    const steps = () =>
      [
        digCatacombs({ area: AREA }),
        placeScatteredRooms(),
        digVeins(),
      ] as const;

    // when
    const results = SEEDS.map((seed) =>
      pipeline(wallMap(), steps(), { random: mulberry32(seed) }),
    );

    // then
    results.forEach(({ grid }, index) => {
      const walkable = tilesOf(grid, Tile.Floor, Tile.Door);
      expect(reached(grid, walkable)).toBe(walkable.length);
      expect(changedGalleries(grid, SEEDS[index] ?? 0)).toEqual([]);
    });
  });

  it('leaves no corner where a vein touches the catacomb diagonally', () => {
    // given
    const steps = () =>
      [
        digCatacombs({ area: AREA }),
        placeScatteredRooms(),
        digVeins(),
      ] as const;

    // when
    const grids = SEEDS.map(
      (seed) => pipeline(wallMap(), steps(), { random: mulberry32(seed) }).grid,
    );

    // then
    for (const grid of grids) {
      expect(diagonalJumps(grid)).toEqual([]);
    }
  });

  it('throws a RangeError for a bad option', () => {
    // given
    const bad: DigCatacombsOptions[] = [
      { mainGalleries: { min: -1, max: 1 } },
      { mainWidth: { min: 0, max: 2 } },
      { sideWidth: { min: 2, max: 1 } },
      { spacing: { min: 0, max: 3 } },
      { loopChance: 1.5 },
      { deadEndChance: -0.1 },
      { nicheDepth: { min: 0, max: 2 } },
      { nicheSpacing: { min: 0, max: 1 } },
      { nicheSides: { min: 1, max: 3 } },
      { nicheSides: { min: 0, max: 1 } },
      { segments: { niches: -1 } },
      { segments: { chambers: -1 } },
      { chamberSize: { width: { min: 0, max: 3 } } },
      { chamberSize: { depth: { min: 3, max: 2 } } },
      { chamberSpacing: { min: 0, max: 1 } },
      { chamberSides: { min: 1, max: 3 } },
      { chamberNicheChance: 2 },
      { deadEndChamberChance: -1 },
      { segments: { niches: Infinity } },
      { segments: {} },
      { doorChance: 1.5 },
      { templates: [{ cells: [] }] },
      { symmetry: 'diagonal' as LayoutSymmetry },
      { symmetryChance: 1.5 },
    ];

    // when
    const attempts = bad.map((options) => () => digCatacombs(options));

    // then
    for (const attempt of attempts) {
      expect(attempt).toThrow(RangeError);
    }
  });

  it('refuses an area too small for two galleries each way before the first attempt', () => {
    // given
    const options = {
      spacing: { min: 3, max: 3 },
      area: { width: { min: 6, max: 20 }, height: { min: 10, max: 10 } },
    };

    // when
    const run = () => pipeline(wallMap(), [digCatacombs(options)]);

    // then
    expect(run).toThrow(RangeError);
  });

  it('refuses an area without the room for niches before the first attempt', () => {
    // given
    const options = {
      spacing: { min: 1, max: 1 },
      nicheDepth: { min: 1, max: 2 },
      area: { width: { min: 12, max: 12 }, height: { min: 12, max: 12 } },
    };

    // when
    const runs = [{ niches: 1 }, BARE].map(
      (segments) => () =>
        pipeline(wallMap(), [digCatacombs({ ...options, segments })]),
    );

    // then
    expect(runs[0]).toThrow(RangeError);
    expect(runs[1]).not.toThrow();
  });

  it('refuses an area without the room for chambers before the first attempt', () => {
    // given
    const options = {
      spacing: { min: 1, max: 1 },
      chamberSize: { depth: { min: 2, max: 3 } },
      area: { width: { min: 20, max: 20 }, height: { min: 20, max: 20 } },
    };

    // when
    const runs = [{ chambers: 1 }, { niches: 1 }].map(
      (segments) => () =>
        pipeline(wallMap(), [digCatacombs({ ...options, segments })]),
    );

    // then
    expect(runs[0]).toThrow(RangeError);
    expect(runs[1]).not.toThrow();
  });

  it('refuses a map that does not start as wall', () => {
    // given
    const base = emptyMap({ width: 40, height: 30, tile: Tile.Floor });

    // when
    const run = () => pipeline(base, [digCatacombs()]);

    // then
    expect(run).toThrow(RangeError);
  });
});
