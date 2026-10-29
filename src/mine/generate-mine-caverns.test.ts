import { describe, expect, it } from 'vitest';
import { findCaveRegions } from '../cave/find-cave-regions';
import type { Grid } from '../core/grid';
import { Tile } from '../core/tile';
import { mulberry32 } from '../test-helpers/mulberry32';
import { generateMine } from './generate-mine';

const base = { width: 80, height: 50 };

function floorTiles(grid: Grid): Set<number> {
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

  it('digs one cavern when only the caverns option is given', () => {
    // given
    const options = { ...base, caverns: {}, random: mulberry32(1) };

    // when
    const { caverns } = generateMine(options);

    // then
    expect(caverns).toHaveLength(1);
  });

  it('digs as many caverns as the count says', () => {
    // given
    const options = {
      ...base,
      caverns: { count: { min: 2, max: 2 } },
      random: mulberry32(2),
    };

    // when
    const { caverns } = generateMine(options);

    // then
    expect(caverns).toHaveLength(2);
  });

  it('keeps every cavern within sides of 12 to 24 tiles by default', () => {
    // given
    const seeds = [1, 2, 3, 4, 5];

    // when
    const mines = seeds.map((seed) =>
      generateMine({ ...base, caverns: {}, random: mulberry32(seed) }),
    );

    // then
    for (const { caverns } of mines) {
      for (const { width, height } of caverns) {
        expect(width).toBeGreaterThanOrEqual(12);
        expect(width).toBeLessThanOrEqual(24);
        expect(height).toBeGreaterThanOrEqual(12);
        expect(height).toBeLessThanOrEqual(24);
      }
    }
  });

  it('takes the size of a cavern from its area', () => {
    // given
    const area = { width: { min: 10, max: 10 }, height: { min: 8, max: 8 } };

    // when
    const { caverns } = generateMine({
      ...base,
      caverns: { area },
      random: mulberry32(1),
    });

    // then
    expect(caverns.map(({ width, height }) => [width, height])).toEqual([
      [10, 8],
    ]);
  });

  it('only adds floor to the mine', () => {
    // given
    const plain = generateMine({ ...base, random: mulberry32(3) });

    // when
    const { grid } = generateMine({
      ...base,
      caverns: { count: { min: 2, max: 2 } },
      random: mulberry32(3),
    });

    // then
    const before = floorTiles(plain.grid);
    const after = floorTiles(grid);
    expect(after.size).toBeGreaterThan(before.size);
    expect([...before].every((tile) => after.has(tile))).toBe(true);
  });

  it('keeps the ring of wall around the map', () => {
    // given
    const options = {
      ...base,
      caverns: { count: { min: 2, max: 2 } },
      random: mulberry32(4),
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

  it('digs every cavern beside the mine, apart from it, as one blob', () => {
    // given
    const options = {
      ...base,
      caverns: { count: { min: 2, max: 2 } },
      tunnels: false,
    } as const;

    // when
    const mines = [1, 2, 3].map((seed) =>
      generateMine({ ...options, random: mulberry32(seed) }),
    );

    // then
    for (const { grid, caverns } of mines) {
      expect(findCaveRegions(grid)).toHaveLength(1 + caverns.length);
    }
  });

  it('joins every cavern to the mine, whatever the layout', () => {
    // given
    const layouts = ['fishbone', 'veins', 'pillars', 'rings'] as const;

    // when
    const mines = layouts.map((layout, i) =>
      generateMine({
        ...base,
        [layout]: {},
        caverns: { count: { min: 0, max: 2 } },
        random: mulberry32(i + 1),
      }),
    );

    // then
    for (const { grid } of mines) {
      expect(findCaveRegions(grid)).toHaveLength(1);
    }
  });

  it('digs larger caverns in a larger area', () => {
    // given
    const make = (size: number) =>
      generateMine({
        ...base,
        caverns: {
          area: {
            width: { min: size, max: size },
            height: { min: size, max: size },
          },
        },
        random: mulberry32(5),
      });

    // when
    const small = make(10);
    const large = make(24);

    // then
    expect(floorTiles(large.grid).size).toBeGreaterThan(
      floorTiles(small.grid).size,
    );
  });

  it('fails the map when a cavern it needs finds no spot', () => {
    // given
    const options = {
      ...base,
      rings: {},
      caverns: { count: { min: 1, max: 1 } },
      random: mulberry32(1),
    };

    // when
    const generate = () => generateMine(options);

    // then
    expect(generate).toThrow('No spot beside the dug ground');
  });

  it('leaves out a cavern above the minimum count that finds no spot', () => {
    // given
    const options = {
      ...base,
      rings: {},
      caverns: { count: { min: 0, max: 1 } },
      random: mulberry32(1),
    };

    // when
    const { caverns, attempts } = generateMine(options);

    // then
    expect(caverns).toEqual([]);
    expect(attempts).toBe(1);
  });

  it('digs a cavern into the tunnels with the overlap placement', () => {
    // given
    const options = {
      ...base,
      rings: {},
      caverns: { placement: 'overlap' },
      random: mulberry32(1),
    } as const;

    // when
    const { grid, caverns } = generateMine(options);

    // then
    expect(caverns).toHaveLength(1);
    expect(findCaveRegions(grid)).toHaveLength(1);
  });

  it('digs caverns on a tiny map without failing', () => {
    // given
    const sizes = [
      [12, 12],
      [8, 30],
    ] as const;

    // when
    const mines = sizes.map(([width, height]) =>
      generateMine({
        width,
        height,
        caverns: { count: { min: 0, max: 2 } },
        random: mulberry32(1),
      }),
    );

    // then
    expect(mines).toHaveLength(sizes.length);
  });

  it.each([
    ['count', { count: { min: -1, max: 1 } }],
    ['fill', { fill: 1.5 }],
    ['placement', { placement: 'anywhere' as 'free' }],
  ])('throws a RangeError for an invalid %s', (name, caverns) => {
    // given
    const options = { ...base, caverns };

    // when
    const generate = () => generateMine(options);

    // then
    expect(generate).toThrow(RangeError);
    expect(generate).toThrow(name);
  });
});
