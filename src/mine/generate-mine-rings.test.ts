import { describe, expect, it } from 'vitest';
import { findCaveRegions } from '../cave/find-cave-regions';
import { Tile } from '../core/tile';
import { mulberry32 } from '../test-helpers/mulberry32';
import { generateMine } from './generate-mine';
import type { MineOptions } from './mine-options';

const base: MineOptions = { width: 80, height: 50, layout: 'rings' };

const kinds = <T extends { kind: string }>(passages: T[], kind: string) =>
  passages.filter((passage) => passage.kind === kind);

describe('generateMine with the rings layout', () => {
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

  it('lists the rings first and the spokes after them', () => {
    // given
    const options = { ...base, random: mulberry32(1) };

    // when
    const { passages } = generateMine(options);

    // then
    const order = passages.map((passage) => passage.kind);
    const firstSpoke = order.indexOf('spoke');
    expect(firstSpoke).toBeGreaterThan(0);
    expect(order.slice(0, firstSpoke).every((kind) => kind === 'ring')).toBe(
      true,
    );
    expect(order.slice(firstSpoke).every((kind) => kind === 'spoke')).toBe(
      true,
    );
  });

  it('digs as many rings as the range says', () => {
    // given
    const options = {
      ...base,
      rings: { min: 3, max: 3 },
      random: mulberry32(1),
    };

    // when
    const { passages } = generateMine(options);

    // then
    expect(kinds(passages, 'ring')).toHaveLength(3);
  });

  it('digs fewer rings when the map has no room for them', () => {
    // given
    const options = {
      width: 20,
      height: 20,
      layout: 'rings' as const,
      rings: { min: 8, max: 8 },
      random: mulberry32(1),
    };

    // when
    const { passages, grid } = generateMine(options);

    // then
    const rings = kinds(passages, 'ring').length;
    expect(rings).toBeGreaterThanOrEqual(1);
    expect(rings).toBeLessThan(8);
    expect(findCaveRegions(grid)).toHaveLength(1);
  });

  it('digs more rings with a higher density', () => {
    // given
    const make = (density: number) =>
      kinds(
        generateMine({ ...base, density, random: mulberry32(1) }).passages,
        'ring',
      ).length;

    // when
    const sparse = make(0.1);
    const dense = make(0.5);

    // then
    expect(dense).toBeGreaterThan(sparse);
  });

  it('ignores the density when it is given a number of rings', () => {
    // given
    const make = (density: number) =>
      generateMine({
        ...base,
        density,
        rings: { min: 3, max: 3 },
        random: mulberry32(1),
      });

    // when
    const sparse = make(0.1);
    const dense = make(0.9);

    // then
    expect(sparse.grid.toString()).toBe(dense.grid.toString());
  });

  it('closes every ring on itself', () => {
    // given
    const options = { ...base, random: mulberry32(2) };

    // when
    const { passages } = generateMine(options);

    // then
    for (const { tiles } of kinds(passages, 'ring')) {
      expect(tiles[0]).toEqual(tiles[tiles.length - 1]);
    }
  });

  it('leaves rock inside the innermost ring', () => {
    // given
    const options = {
      ...base,
      rings: { min: 2, max: 2 },
      ringWidth: { min: 2, max: 2 },
      random: mulberry32(1),
    };

    // when
    const { grid } = generateMine(options);

    // then
    expect(grid.get(40, 25)).toBe(Tile.Wall);
  });

  it('digs the rings as wide as the ring width says', () => {
    // given
    const options = {
      ...base,
      ringWidth: { min: 3, max: 3 },
      random: mulberry32(1),
    };

    // when
    const { passages } = generateMine(options);

    // then
    expect(kinds(passages, 'ring').every((ring) => ring.width === 3)).toBe(
      true,
    );
  });

  it('keeps the rings on an oval at a ring wobble of 0', () => {
    // given
    const options = {
      ...base,
      rings: { min: 1, max: 1 },
      ringWidth: { min: 2, max: 2 },
      ringWobble: 0,
      random: mulberry32(1),
    };

    // when
    const { passages } = generateMine(options);

    // then
    const [ring] = kinds(passages, 'ring');
    const misses = (ring?.tiles ?? []).map((tile) =>
      Math.abs(
        ((tile.x + 0.5 - 40) / 37) ** 2 + ((tile.y + 0.5 - 25) / 22) ** 2 - 1,
      ),
    );
    expect(Math.max(...misses)).toBeLessThan(0.15);
  });

  it('makes the same mine for the oval shape as for the default', () => {
    // given
    const options = { ...base, random: mulberry32(8) };

    // when
    const byDefault = generateMine(options);
    const oval = generateMine({
      ...options,
      ringShape: 'oval',
      random: mulberry32(8),
    });

    // then
    expect(oval.grid.toString()).toBe(byDefault.grid.toString());
  });

  it('keeps a ring on a circle with the circle shape', () => {
    // given
    const options: MineOptions = {
      ...base,
      rings: { min: 1, max: 1 },
      ringShape: 'circle',
      ringWidth: { min: 2, max: 2 },
      ringWobble: 0,
      random: mulberry32(1),
    };

    // when
    const { passages } = generateMine(options);

    // then
    const [ring] = kinds(passages, 'ring');
    const misses = (ring?.tiles ?? []).map((tile) =>
      Math.abs(
        ((tile.x + 0.5 - 40) ** 2 + (tile.y + 0.5 - 25) ** 2) / 22 ** 2 - 1,
      ),
    );
    expect(ring?.tiles.length).toBeGreaterThan(0);
    expect(Math.max(...misses)).toBeLessThan(0.15);
  });

  it('leaves the ends of a wide map as rock with the circle shape', () => {
    // given
    const options: MineOptions = {
      ...base,
      ringShape: 'circle',
      random: mulberry32(2),
    };

    // when
    const { grid } = generateMine(options);

    // then
    let floorAtTheEnds = 0;
    for (let y = 0; y < grid.height; ++y) {
      for (let x = 0; x < 15; ++x) {
        floorAtTheEnds += grid.get(x, y) === Tile.Floor ? 1 : 0;
        floorAtTheEnds +=
          grid.get(grid.width - 1 - x, y) === Tile.Floor ? 1 : 0;
      }
    }
    expect(floorAtTheEnds).toBe(0);
  });

  it('makes the same mine for both shapes on a square map', () => {
    // given
    const square: MineOptions = { ...base, width: 60, height: 60 };

    // when
    const oval = generateMine({ ...square, random: mulberry32(3) });
    const circle = generateMine({
      ...square,
      ringShape: 'circle',
      random: mulberry32(3),
    });

    // then
    expect(circle.grid.toString()).toBe(oval.grid.toString());
  });

  it('throws a RangeError for a ring shape that does not exist', () => {
    // given
    const options = { ...base, ringShape: 'square' } as unknown as MineOptions;

    // when
    const generate = () => generateMine(options);

    // then
    expect(generate).toThrow(RangeError);
  });

  it('bends the rings off the oval at a ring wobble of 1', () => {
    // given
    const options = {
      ...base,
      rings: { min: 1, max: 1 },
      ringWidth: { min: 2, max: 2 },
      ringWobble: 1,
      random: mulberry32(1),
    };

    // when
    const { passages } = generateMine(options);

    // then
    const [ring] = kinds(passages, 'ring');
    const misses = (ring?.tiles ?? []).map((tile) =>
      Math.abs(
        ((tile.x + 0.5 - 40) / 37) ** 2 + ((tile.y + 0.5 - 25) / 22) ** 2 - 1,
      ),
    );
    expect(Math.max(...misses)).toBeGreaterThan(0.2);
  });

  it('joins every ring to the next with as many spokes as the range says', () => {
    // given
    const options = {
      ...base,
      rings: { min: 3, max: 3 },
      spokes: { min: 3, max: 3 },
      random: mulberry32(1),
    };

    // when
    const { passages } = generateMine(options);

    // then
    expect(kinds(passages, 'spoke')).toHaveLength(6);
  });

  it('digs a spoke at least between every two rings', () => {
    // given
    const options = {
      ...base,
      rings: { min: 4, max: 4 },
      spokes: { min: 0, max: 0 },
      random: mulberry32(1),
    };

    // when
    const { passages, grid } = generateMine(options);

    // then
    expect(kinds(passages, 'spoke')).toHaveLength(3);
    expect(findCaveRegions(grid)).toHaveLength(1);
  });

  it('digs the spokes as wide as the vein width says', () => {
    // given
    const options = {
      ...base,
      veinWidth: { min: 1, max: 1 },
      random: mulberry32(1),
    };

    // when
    const { passages } = generateMine(options);

    // then
    const spokes = kinds(passages, 'spoke');
    expect(spokes.length).toBeGreaterThan(0);
    expect(spokes.every((spoke) => spoke.width === 1)).toBe(true);
  });

  it('keeps the ring around the map as wall', () => {
    // given
    const options = {
      ...base,
      rings: { min: 8, max: 8 },
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

  it('makes one connected piece, whatever the settings', () => {
    // given
    const settings = Array.from({ length: 40 }, (_, i) => ({
      density: 0.05 + (i % 6) / 6,
      ringWobble: (i % 3) / 2,
      spokes: { min: 0, max: 1 + (i % 4) },
      minExits: i % 3,
    }));

    // when
    const mines = settings.map((setting, i) =>
      generateMine({ ...base, ...setting, random: mulberry32(i + 1) }),
    );

    // then
    for (const { grid } of mines) {
      expect(findCaveRegions(grid)).toHaveLength(1);
    }
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

  it('lists no halls', () => {
    // given
    const options = { ...base, random: mulberry32(1) };

    // when
    const { halls } = generateMine(options);

    // then
    expect(halls).toEqual([]);
  });

  it('ignores the options of the other layouts', () => {
    // given
    const plain = generateMine({ ...base, random: mulberry32(1) });

    // when
    const other = generateMine({
      ...base,
      shaftWidth: { min: 5, max: 5 },
      veinSpacing: 5,
      halls: { min: 4, max: 4 },
      pillarJitter: 1,
      random: mulberry32(1),
    });

    // then
    expect(other.grid.toString()).toBe(plain.grid.toString());
  });

  it('digs no floor on a map too small for a ring', () => {
    // given
    const options = { width: 3, height: 3, layout: 'rings' as const };

    // when
    const { grid, passages } = generateMine(options);

    // then
    expect(passages).toEqual([]);
    expect(grid.toString()).not.toContain('.');
  });

  it('digs a mine on a small or thin map without failing', () => {
    // given
    const sizes = [
      [1, 1],
      [2, 2],
      [8, 8],
      [12, 12],
      [5, 30],
      [30, 5],
    ] as const;

    // when
    const mines = sizes.map(([width, height]) =>
      generateMine({ width, height, layout: 'rings', random: mulberry32(1) }),
    );

    // then
    expect(mines).toHaveLength(sizes.length);
  });

  it.each([
    ['rings', { rings: { min: 0, max: 2 } }],
    ['rings', { rings: { min: 3, max: 2 } }],
    ['ringWidth', { ringWidth: { min: 0, max: 2 } }],
    ['ringWobble', { ringWobble: 1.5 }],
    ['spokes', { spokes: { min: -1, max: 2 } }],
    ['spokes', { spokes: { min: 3, max: 2 } }],
  ])('throws a RangeError for an invalid %s', (_name, invalid) => {
    // given
    const options = { ...base, ...invalid };

    // when
    const generate = () => generateMine(options);

    // then
    expect(generate).toThrow(RangeError);
  });
});
