import { describe, expect, it } from 'vitest';
import type { Grid } from '../core/grid';
import { Tile } from '../core/tile';
import type { RoomShape } from '../rooms/room-shape';
import { TemplateCell } from '../rooms/templates/template-cell';
import { countAsymmetry } from '../test-helpers/count-asymmetry';
import { mulberry32 } from '../test-helpers/mulberry32';
import type { CaveOptions } from './cave-options';
import { findCaveRegions } from './find-cave-regions';
import { generateCave } from './generate-cave';

function cave(options: Partial<CaveOptions> = {}, seed = 1) {
  return generateCave({
    width: 60,
    height: 40,
    random: mulberry32(seed),
    ...options,
  });
}

/** The floor tiles of the shapes, all told. */
function floorOf(shapes: readonly RoomShape[]) {
  return shapes
    .flatMap(({ cells }) => cells.flat())
    .filter((cell) => cell === TemplateCell.Floor).length;
}

function count(grid: Grid, tile: Tile) {
  let total = 0;
  for (let y = 0; y < grid.height; ++y) {
    for (let x = 0; x < grid.width; ++x) {
      total += grid.get(x, y) === tile ? 1 : 0;
    }
  }
  return total;
}

describe('generateCave', () => {
  it('makes a map of the size that was asked for', () => {
    // given
    const options = { width: 30, height: 20 };

    // when
    const { grid } = cave(options);

    // then
    expect([grid.width, grid.height]).toEqual([30, 20]);
  });

  it('makes the same cave from the same seed', () => {
    // given
    const seed = 7;

    // when
    const first = cave({}, seed);
    const second = cave({}, seed);

    // then
    expect(first.grid.toString()).toBe(second.grid.toString());
  });

  it('makes another cave from another seed', () => {
    // given
    const first = cave({}, 1);

    // when
    const second = cave({}, 2);

    // then
    expect(first.grid.toString()).not.toBe(second.grid.toString());
  });

  it('does not require a random source', () => {
    // given
    const options = { width: 10, height: 10 };

    // when
    const { grid } = generateCave(options);

    // then
    expect(grid.width).toBe(10);
  });

  it('uses only walls and floors without exits', () => {
    // given
    const options = {};

    // when
    const { grid } = cave(options);

    // then
    expect(count(grid, Tile.Wall) + count(grid, Tile.Floor)).toBe(60 * 40);
  });

  it.each([1, 2, 3, 5])(
    'joins all caverns into one by default (seed %i)',
    (seed) => {
      // given
      const separate = cave({ tunnels: false }, seed);

      // when
      const { grid } = cave({}, seed);

      // then
      expect(findCaveRegions(separate.grid).length).toBeGreaterThan(1);
      expect(findCaveRegions(grid)).toHaveLength(1);
    },
  );

  it('passes the tunnel options to digVeins', () => {
    // given
    const narrow = cave({}, 2);

    // when
    const wide = cave({ tunnels: { veinWidth: { min: 3, max: 3 } } }, 2);

    // then
    expect(count(wide.grid, Tile.Floor)).toBeGreaterThan(
      count(narrow.grid, Tile.Floor),
    );
  });

  it('passes the cave options to digCellularCave', () => {
    // given
    const options = { cave: { fillChance: 1, iterations: 0 } };

    // when
    const { grid, rooms } = cave(options);

    // then
    expect(count(grid, Tile.Floor)).toBe(0);
    expect(rooms).toEqual([]);
  });

  it('keeps only the largest cavern with largestOnly and no tunnels', () => {
    // given
    const loose = cave({ tunnels: false }, 2);

    // when
    const { grid, rooms, roomShapes } = cave(
      { cave: { largestOnly: true }, tunnels: false },
      2,
    );

    // then
    const [largest] = findCaveRegions(loose.grid);
    expect(rooms).toHaveLength(1);
    expect(floorOf(roomShapes)).toBe(largest?.length);
    expect(count(grid, Tile.Floor)).toBe(largest?.length);
  });

  it('lists every cavern as a room of kind cavern in the one cave group', () => {
    // given
    const options = { tunnels: false } as const;

    // when
    const { grid, rooms, roomGroups } = cave(options, 2);

    // then
    expect(rooms).toHaveLength(findCaveRegions(grid).length);
    expect(
      rooms.every(({ kind, group }) => kind === 'cavern' && group === 0),
    ).toBe(true);
    expect(roomGroups).toEqual([
      { kind: 'cave', area: { x: 0, y: 0, width: 60, height: 40 } },
    ]);
  });

  it('lists caverns whose shapes hold every floor tile', () => {
    // given
    const options = { tunnels: false } as const;

    // when
    const { grid, roomShapes } = cave(options, 2);

    // then
    expect(floorOf(roomShapes)).toBe(count(grid, Tile.Floor));
  });

  it('lists the caverns as they were dug, before the tunnels joined them', () => {
    // given
    const loose = cave({ tunnels: false }, 2);

    // when
    const { rooms } = cave({}, 2);

    // then
    const boxes = (list: typeof rooms) =>
      list.map(({ x, y, width, height }) => ({ x, y, width, height }));
    expect(rooms.length).toBeGreaterThan(1);
    expect(boxes(rooms)).toEqual(boxes(loose.rooms));
  });

  it('records where the tunnels enter the caverns', () => {
    // given
    const options = {};

    // when
    const { rooms, roomExits } = cave(options, 2);

    // then
    expect(roomExits.length).toBeGreaterThan(0);
    for (const room of rooms) {
      expect(room.exitCount).toBeGreaterThan(0);
      for (const index of room.exits) {
        expect(roomExits[index]?.rooms).toContain(room.id);
      }
    }
  });

  it('records no ways in without tunnels', () => {
    // given
    const options = { tunnels: false } as const;

    // when
    const { rooms, roomExits } = cave(options, 2);

    // then
    expect(roomExits).toEqual([]);
    expect(rooms.every(({ exitCount }) => exitCount === 0)).toBe(true);
  });

  it('adds no exits by default', () => {
    // given
    const options = {};

    // when
    const { exits } = cave(options);

    // then
    expect(exits).toEqual([]);
  });

  it('carves the exits that were asked for into the border', () => {
    // given
    const options = { exits: { count: { min: 3, max: 3 } } };

    // when
    const { grid, exits } = cave(options);

    // then
    expect(exits).toHaveLength(3);
    for (const { x, y } of exits) {
      expect(grid.get(x, y)).toBe(Tile.Door);
      expect(x === 0 || y === 0 || x === 59 || y === 39).toBe(true);
    }
  });

  it.each(['horizontal', 'vertical', 'both', 'rotational'] as const)(
    'makes a nearly %s cave when every step is given the symmetry',
    (symmetry) => {
      // given
      const options = {
        cave: { symmetry, fillChance: 0.5 },
        tunnels: { symmetry },
        exits: { symmetry, count: { min: 4, max: 4 } },
      };
      const plain = { ...options, tunnels: {} };

      // when
      const seeds = [1, 2, 3];
      const mirrored = seeds.map((seed) => cave(options, seed).grid);
      const loose = seeds.map((seed) => cave(plain, seed).grid);

      // then
      const total = (grids: Grid[]) =>
        grids.reduce((sum, grid) => sum + countAsymmetry(grid, symmetry), 0);
      expect(total(mirrored)).toBeLessThan(total(loose));
    },
  );

  it('reports one attempt and no failures', () => {
    // given
    const options = {};

    // when
    const { attempts, failures } = cave(options);

    // then
    expect(attempts).toBe(1);
    expect(failures).toEqual([]);
  });

  it.each([
    ['width', { width: 0 }],
    ['height', { height: 2.5 }],
    ['fillChance', { cave: { fillChance: 1.5 } }],
    ['veinWidth', { tunnels: { veinWidth: { min: 0, max: 1 } } }],
    ['count', { exits: { count: { min: -1, max: 1 } } }],
  ])('throws a RangeError for an invalid %s', (name, options) => {
    // given
    const generate = () => cave(options);

    // when / then
    expect(generate).toThrow(RangeError);
    expect(generate).toThrow(name);
  });
});
