import { describe, expect, it } from 'vitest';
import { findCaveRegions } from '../cave/find-cave-regions';
import type { Grid } from '../core/grid';
import { Tile } from '../core/tile';
import { mulberry32 } from '../test-helpers/mulberry32';
import { generateMine } from './generate-mine';
import type { MineOptions } from './mine-options';

const base: MineOptions = { width: 80, height: 50, layout: 'veins' };

function floorShare(grid: Grid): number {
  return (grid.toString().split('.').length - 1) / (grid.width * grid.height);
}

describe('generateMine with the veins layout', () => {
  it('makes the same mine from the same seed', () => {
    // given
    const make = () => generateMine({ ...base, random: mulberry32(5) });

    // when
    const first = make();
    const second = make();

    // then
    expect(first.grid.toString()).toBe(second.grid.toString());
    expect(first.passages).toEqual(second.passages);
  });

  it('makes different mines from different seeds', () => {
    // given
    const options = base;

    // when
    const first = generateMine({ ...options, random: mulberry32(1) });
    const second = generateMine({ ...options, random: mulberry32(2) });

    // then
    expect(first.grid.toString()).not.toBe(second.grid.toString());
  });

  it('lists nothing but veins', () => {
    // given
    const options = { ...base, random: mulberry32(1) };

    // when
    const { passages } = generateMine(options);

    // then
    expect(passages.length).toBeGreaterThan(1);
    expect(passages.every((passage) => passage.kind === 'vein')).toBe(true);
  });

  it('keeps the ring around the map as wall', () => {
    // given
    const options = { ...base, density: 0.4, random: mulberry32(3) };

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

  it('makes one connected piece, whatever the settings', () => {
    // given
    const settings = [0, 0.1, 0.2, 0.4].flatMap((density) =>
      [0, 1].map((veinWindiness) => ({ density, veinWindiness })),
    );

    // when
    const mines = settings.map((setting, i) =>
      generateMine({ ...base, ...setting, random: mulberry32(i + 1) }),
    );

    // then
    for (const { grid } of mines) {
      expect(findCaveRegions(grid)).toHaveLength(1);
    }
  });

  it('keeps veins that wind off the map in one piece', () => {
    // given
    const seeds = Array.from({ length: 20 }, (_, i) => i + 1);

    // when
    const mines = seeds.map((seed) =>
      generateMine({
        width: 60,
        height: 12,
        layout: 'veins',
        veinWindiness: 1,
        density: 0.3,
        random: mulberry32(seed),
      }),
    );

    // then
    for (const { grid } of mines) {
      expect(findCaveRegions(grid)).toHaveLength(1);
    }
  });

  it('digs extra veins until the density is reached', () => {
    // given
    const options = { ...base, density: 0.2, random: mulberry32(4) };

    // when
    const { grid } = generateMine(options);

    // then
    expect(floorShare(grid)).toBeGreaterThanOrEqual(0.2);
    expect(floorShare(grid)).toBeLessThan(0.3);
  });

  it('digs more veins with a higher density', () => {
    // given
    const make = (density: number) =>
      generateMine({ ...base, density, random: mulberry32(4) });

    // when
    const sparse = make(0.1);
    const dense = make(0.25);

    // then
    expect(dense.passages.length).toBeGreaterThan(sparse.passages.length);
    expect(floorShare(dense.grid)).toBeGreaterThan(floorShare(sparse.grid));
  });

  it('digs only the veins that join the junctions with a density of 0', () => {
    // given
    const options = { ...base, density: 0, random: mulberry32(1) };

    // when
    const { grid, passages } = generateMine(options);

    // then
    const junctions = passages.length + 1;
    expect(junctions).toBeGreaterThan(2);
    expect(findCaveRegions(grid)).toHaveLength(1);
  });

  it('stops short when there are no more veins to dig', () => {
    // given
    const options = { ...base, density: 1, random: mulberry32(1) };

    // when
    const { grid } = generateMine(options);

    // then
    expect(floorShare(grid)).toBeLessThan(1);
  });

  it('digs veins as wide as the vein width says', () => {
    // given
    const options = {
      ...base,
      veinWidth: { min: 3, max: 3 },
      random: mulberry32(1),
    };

    // when
    const { passages } = generateMine(options);

    // then
    expect(passages.every((passage) => passage.width === 3)).toBe(true);
  });

  it('makes fewer, longer veins with a larger spacing', () => {
    // given
    const make = (veinSpacing: number) =>
      generateMine({
        ...base,
        veinSpacing,
        density: 0,
        random: mulberry32(1),
      });

    // when
    const fine = make(8);
    const coarse = make(30);

    // then
    expect(fine.passages.length).toBeGreaterThan(coarse.passages.length);
  });

  it('makes every vein a path of tiles that touch along edges', () => {
    // given
    const options = { ...base, density: 0.25, random: mulberry32(2) };

    // when
    const { passages } = generateMine(options);

    // then
    for (const { tiles } of passages) {
      for (let i = 1; i < tiles.length; ++i) {
        const before = tiles[i - 1];
        const tile = tiles[i];
        expect(
          Math.abs((tile?.x ?? 0) - (before?.x ?? 0)) +
            Math.abs((tile?.y ?? 0) - (before?.y ?? 0)),
        ).toBe(1);
      }
    }
  });

  it('digs floor along every vein', () => {
    // given
    const options = { ...base, random: mulberry32(6) };

    // when
    const { grid, passages } = generateMine(options);

    // then
    for (const { tiles } of passages) {
      for (const tile of tiles) {
        expect(grid.get(tile.x, tile.y)).toBe(Tile.Floor);
      }
    }
  });

  it('keeps veins close to a straight line when they are not windy', () => {
    // given
    const options = {
      ...base,
      veinWindiness: 0,
      density: 0,
      random: mulberry32(1),
    };

    // when
    const { passages } = generateMine(options);

    // then
    for (const { tiles } of passages) {
      const first = tiles[0];
      const last = tiles[tiles.length - 1];
      if (!first || !last) {
        continue;
      }
      const length = Math.hypot(last.x - first.x, last.y - first.y);
      for (const tile of tiles) {
        const off =
          length === 0
            ? 0
            : Math.abs(
                (last.x - first.x) * (first.y - tile.y) -
                  (first.x - tile.x) * (last.y - first.y),
              ) / length;
        expect(off).toBeLessThanOrEqual(1.5);
      }
    }
  });

  it('winds the veins away from a straight line when they are windy', () => {
    // given
    const options = {
      ...base,
      veinWindiness: 1,
      density: 0,
      veinSpacing: 30,
      random: mulberry32(1),
    };

    // when
    const { passages } = generateMine(options);

    // then
    const offsets = passages.flatMap(({ tiles }) => {
      const first = tiles[0];
      const last = tiles[tiles.length - 1];
      if (!first || !last) {
        return [];
      }
      const length = Math.hypot(last.x - first.x, last.y - first.y) || 1;
      return tiles.map(
        (tile) =>
          Math.abs(
            (last.x - first.x) * (first.y - tile.y) -
              (first.x - tile.x) * (last.y - first.y),
          ) / length,
      );
    });
    expect(Math.max(...offsets)).toBeGreaterThan(3);
  });

  it('adds exits on the border and keeps the mine connected', () => {
    // given
    const options = { ...base, minExits: 3, random: mulberry32(1) };

    // when
    const { grid, exits } = generateMine(options);

    // then
    expect(exits).toHaveLength(3);
    for (const { x, y } of exits) {
      expect(grid.get(x, y)).toBe(Tile.Door);
    }
    expect(findCaveRegions(grid)).toHaveLength(1);
  });

  it('ignores the options of the fishbone', () => {
    // given
    const plain = generateMine({ ...base, random: mulberry32(1) });

    // when
    const other = generateMine({
      ...base,
      shaftWidth: { min: 5, max: 5 },
      aditLength: { min: 1, max: 2 },
      angle: 33,
      loops: 1,
      random: mulberry32(1),
    });

    // then
    expect(other.grid.toString()).toBe(plain.grid.toString());
  });

  it('digs a mine on a tiny map without failing', () => {
    // given
    const sizes = [
      [1, 1],
      [2, 2],
      [3, 3],
      [5, 30],
      [30, 5],
    ] as const;

    // when
    const mines = sizes.map(([width, height]) =>
      generateMine({ width, height, layout: 'veins', random: mulberry32(1) }),
    );

    // then
    expect(mines).toHaveLength(sizes.length);
  });

  it.each([
    ['veinSpacing', { veinSpacing: 2 }],
    ['veinSpacing', { veinSpacing: 10.5 }],
    ['veinWindiness', { veinWindiness: 1.2 }],
    ['veinWidth', { veinWidth: { min: 0, max: 2 } }],
    ['veinWidth', { veinWidth: { min: 3, max: 2 } }],
  ])('throws a RangeError for an invalid %s', (_name, invalid) => {
    // given
    const options = { ...base, ...invalid };

    // when
    const generate = () => generateMine(options);

    // then
    expect(generate).toThrow(RangeError);
  });
});
