import { describe, expect, it } from 'vitest';
import { findCaveRegions } from '../cave/find-cave-regions';
import { Tile } from '../core/tile';
import { mulberry32 } from '../test-helpers/mulberry32';
import { generateMine } from './generate-mine';
import type { MineLayout } from './mine-layout';
import type { MineOptions } from './mine-options';

const base: MineOptions = { width: 80, height: 50 };
const layouts: MineLayout[] = ['fishbone', 'veins', 'pillars', 'rings'];

function floorTiles(grid: {
  width: number;
  height: number;
  get: (x: number, y: number) => Tile;
}) {
  const tiles = new Set<number>();
  for (let y = 0; y < grid.height; ++y) {
    for (let x = 0; x < grid.width; ++x) {
      if (grid.get(x, y) === Tile.Floor) {
        tiles.add(y * grid.width + x);
      }
    }
  }
  return tiles;
}

describe('generateMine with caverns', () => {
  it('digs no caverns by default', () => {
    // given
    const options = { ...base, random: mulberry32(1) };

    // when
    const { caverns } = generateMine(options);

    // then
    expect(caverns).toEqual([]);
  });

  it('makes the same mine as before when there are no caverns', () => {
    // given
    const plain = generateMine({ ...base, random: mulberry32(1) });

    // when
    const zero = generateMine({
      ...base,
      caverns: { min: 0, max: 0 },
      random: mulberry32(1),
    });

    // then
    expect(zero.grid.toString()).toBe(plain.grid.toString());
  });

  it('makes the same mine from the same seed', () => {
    // given
    const make = () =>
      generateMine({
        ...base,
        caverns: { min: 3, max: 3 },
        random: mulberry32(5),
      });

    // when
    const first = make();
    const second = make();

    // then
    expect(first.grid.toString()).toBe(second.grid.toString());
    expect(first.caverns).toEqual(second.caverns);
  });

  it('digs as many caverns as the range says, when there is room', () => {
    // given
    const options = {
      ...base,
      caverns: { min: 3, max: 3 },
      random: mulberry32(4),
    };

    // when
    const { caverns } = generateMine(options);

    // then
    expect(caverns).toHaveLength(3);
  });

  it('digs fewer caverns when the map has no room for them', () => {
    // given
    const options = {
      width: 40,
      height: 40,
      caverns: { min: 6, max: 6 },
      cavernSize: { min: 30, max: 30 },
      random: mulberry32(1),
    };

    // when
    const { caverns, grid } = generateMine(options);

    // then
    expect(caverns.length).toBeLessThan(6);
    expect(findCaveRegions(grid)).toHaveLength(1);
  });

  it('keeps the size of every cavern within the cavern size', () => {
    // given
    const options = {
      ...base,
      caverns: { min: 4, max: 4 },
      cavernSize: { min: 10, max: 15 },
      random: mulberry32(2),
    };

    // when
    const { caverns } = generateMine(options);

    // then
    expect(caverns.length).toBeGreaterThan(0);
    for (const cavern of caverns) {
      expect(cavern.width).toBeGreaterThanOrEqual(10);
      expect(cavern.width).toBeLessThanOrEqual(15);
      expect(cavern.height).toBeGreaterThanOrEqual(10);
      expect(cavern.height).toBeLessThanOrEqual(15);
    }
  });

  it('keeps the caverns inside the ring of wall around the map', () => {
    // given
    const options = {
      ...base,
      caverns: { min: 5, max: 5 },
      random: mulberry32(3),
    };

    // when
    const { caverns, grid } = generateMine(options);

    // then
    for (const cavern of caverns) {
      expect(cavern.x).toBeGreaterThanOrEqual(1);
      expect(cavern.y).toBeGreaterThanOrEqual(1);
      expect(cavern.x + cavern.width).toBeLessThanOrEqual(grid.width - 1);
      expect(cavern.y + cavern.height).toBeLessThanOrEqual(grid.height - 1);
    }
  });

  it('keeps the ring of wall around the map', () => {
    // given
    const options = {
      ...base,
      caverns: { min: 5, max: 5 },
      random: mulberry32(3),
    };

    // when
    const { grid } = generateMine(options);

    // then
    for (let x = 0; x < grid.width; ++x) {
      expect(grid.get(x, 0)).toBe(Tile.Wall);
      expect(grid.get(x, grid.height - 1)).toBe(Tile.Wall);
    }
    for (let y = 0; y < grid.height; ++y) {
      expect(grid.get(0, y)).toBe(Tile.Wall);
      expect(grid.get(grid.width - 1, y)).toBe(Tile.Wall);
    }
  });

  it('only adds floor to the mine', () => {
    // given
    const plain = generateMine({ ...base, random: mulberry32(6) });

    // when
    const withCaverns = generateMine({
      ...base,
      caverns: { min: 3, max: 3 },
      random: mulberry32(6),
    });

    // then
    const before = floorTiles(plain.grid);
    const after = floorTiles(withCaverns.grid);
    expect(after.size).toBeGreaterThan(before.size);
    for (const tile of before) {
      expect(after.has(tile)).toBe(true);
    }
  });

  it('digs more floor with larger caverns', () => {
    // given
    const make = (size: number) =>
      floorTiles(
        generateMine({
          ...base,
          caverns: { min: 2, max: 2 },
          cavernSize: { min: size, max: size },
          random: mulberry32(1),
        }).grid,
      ).size;

    // when
    const small = make(8);
    const large = make(24);

    // then
    expect(large).toBeGreaterThan(small);
  });

  it('digs smaller caverns at a higher cavern fill', () => {
    // given
    const make = (cavernFill: number) =>
      floorTiles(
        generateMine({
          ...base,
          caverns: { min: 2, max: 2 },
          cavernSize: { min: 20, max: 20 },
          cavernFill,
          random: mulberry32(1),
        }).grid,
      ).size;

    // when
    const open = make(0.2);
    const tight = make(0.7);

    // then
    expect(open).toBeGreaterThan(tight);
  });

  it('joins every cavern to the mine, whatever the layout', () => {
    // given
    const seeds = [1, 2, 3, 4, 5];

    // when
    const mines = layouts.flatMap((layout) =>
      seeds.map((seed) =>
        generateMine({
          ...base,
          layout,
          caverns: { min: 1, max: 4 },
          minExits: seed % 3,
          random: mulberry32(seed),
        }),
      ),
    );

    // then
    for (const { grid } of mines) {
      expect(findCaveRegions(grid)).toHaveLength(1);
    }
  });

  it('lists the tunnels that join caverns to the mine after the others', () => {
    // given
    const options = {
      width: 200,
      height: 120,
      density: 0,
      caverns: { min: 4, max: 4 },
      cavernSize: { min: 8, max: 10 },
      random: mulberry32(1),
    };

    // when
    const { passages, caverns, grid } = generateMine(options);

    // then
    expect(findCaveRegions(grid)).toHaveLength(1);
    const kinds = passages.map((passage) => passage.kind);
    const first = kinds.indexOf('tunnel');
    expect(first).toBeGreaterThan(0);
    expect(kinds.slice(first).every((kind) => kind === 'tunnel')).toBe(true);
    expect(
      kinds.filter((kind) => kind === 'tunnel').length,
    ).toBeLessThanOrEqual(caverns.length);
  });

  it('leaves the halls and rings where they were', () => {
    // given
    const plain = generateMine({
      ...base,
      layout: 'pillars',
      random: mulberry32(1),
    });

    // when
    const withCaverns = generateMine({
      ...base,
      layout: 'pillars',
      caverns: { min: 2, max: 2 },
      random: mulberry32(1),
    });

    // then
    expect(withCaverns.halls).toEqual(plain.halls);
  });

  it('digs caverns on a tiny map without failing', () => {
    // given
    const sizes = [
      [1, 1],
      [3, 3],
      [6, 6],
      [12, 12],
      [5, 30],
    ] as const;

    // when
    const mines = sizes.map(([width, height]) =>
      generateMine({
        width,
        height,
        caverns: { min: 2, max: 2 },
        random: mulberry32(1),
      }),
    );

    // then
    expect(mines).toHaveLength(sizes.length);
  });

  it.each([
    ['caverns', { caverns: { min: -1, max: 2 } }],
    ['caverns', { caverns: { min: 3, max: 2 } }],
    ['cavernSize', { cavernSize: { min: 2, max: 5 } }],
    ['cavernSize', { cavernSize: { min: 9, max: 5 } }],
    ['cavernFill', { cavernFill: 1.5 }],
  ])('throws a RangeError for an invalid %s', (_name, invalid) => {
    // given
    const options = { ...base, ...invalid };

    // when
    const generate = () => generateMine(options);

    // then
    expect(generate).toThrow(RangeError);
  });
});
