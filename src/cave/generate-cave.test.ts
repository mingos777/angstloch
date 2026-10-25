import { describe, expect, it } from 'vitest';
import { generateCave } from './generate-cave';
import type { Grid } from '../core/grid';
import { mulberry32 } from '../test-helpers/mulberry32';
import { Tile } from '../core/tile';

function countTiles(grid: Grid, tile: Tile) {
  return grid
    .toString()
    .split('')
    .filter((c) => c === (tile === Tile.Wall ? '#' : '.')).length;
}

describe('generateCave', () => {
  it('returns a grid of the requested size', () => {
    // given
    const options = { width: 30, height: 20, random: mulberry32(1) };

    // when
    const { grid } = generateCave(options);

    // then
    expect([grid.width, grid.height]).toEqual([30, 20]);
  });

  it('is deterministic for the same seed', () => {
    // given
    const options = { width: 40, height: 30 };

    // when
    const a = generateCave({ ...options, random: mulberry32(7) });
    const b = generateCave({ ...options, random: mulberry32(7) });

    // then
    expect(a.grid.toString()).toBe(b.grid.toString());
  });

  it('differs between seeds', () => {
    // given
    const options = { width: 40, height: 30 };

    // when
    const a = generateCave({ ...options, random: mulberry32(1) });
    const b = generateCave({ ...options, random: mulberry32(2) });

    // then
    expect(a.grid.toString()).not.toBe(b.grid.toString());
  });

  it('uses only walls and floors', () => {
    // given
    const options = { width: 40, height: 30, random: mulberry32(3) };

    // when
    const { grid } = generateCave(options);

    // then
    expect(countTiles(grid, Tile.Wall) + countTiles(grid, Tile.Floor)).toBe(
      1200,
    );
  });

  it('keeps the border solid by default', () => {
    // given
    const options = {
      width: 30,
      height: 20,
      fillChance: 0,
      random: mulberry32(1),
    };

    // when
    const { grid } = generateCave(options);

    // then
    const rows = grid.toString().split('\n');
    expect(rows[0]).toBe('#'.repeat(30));
    expect(rows[10]?.[0]).toBe('#');
    expect(rows[10]?.[29]).toBe('#');
  });

  it('can leave the border open', () => {
    // given
    const options = {
      width: 30,
      height: 20,
      fillChance: 0,
      iterations: 0,
      borderWalls: false,
      random: mulberry32(1),
    };

    // when
    const { grid } = generateCave(options);

    // then
    expect(countTiles(grid, Tile.Wall)).toBe(0);
  });

  it('makes a map of all floor with a fill chance of 0 and no border', () => {
    // given
    const options = {
      width: 10,
      height: 10,
      fillChance: 0,
      iterations: 0,
      borderWalls: false,
    };

    // when
    const { grid } = generateCave(options);

    // then
    expect(countTiles(grid, Tile.Floor)).toBe(100);
  });

  it('makes a map of all walls with a fill chance of 1', () => {
    // given
    const options = { width: 10, height: 10, fillChance: 1, iterations: 0 };

    // when
    const { grid } = generateCave(options);

    // then
    expect(countTiles(grid, Tile.Wall)).toBe(100);
  });

  it('applies no smoothing with zero iterations', () => {
    // given
    const options = { width: 40, height: 30, iterations: 0 };

    // when
    const raw = generateCave({ ...options, random: mulberry32(5) });
    const smooth = generateCave({
      ...options,
      iterations: 4,
      random: mulberry32(5),
    });

    // then
    expect(raw.grid.toString()).not.toBe(smooth.grid.toString());
  });

  it('smooths the noise into larger clumps', () => {
    // given
    const options = { width: 60, height: 40, random: mulberry32(9) };
    const transitions = (grid: Grid) => {
      let count = 0;
      for (let y = 0; y < grid.height; ++y) {
        for (let x = 1; x < grid.width; ++x) {
          count += grid.get(x, y) === grid.get(x - 1, y) ? 0 : 1;
        }
      }
      return count;
    };

    // when
    const raw = generateCave({ ...options, iterations: 0 });
    const smooth = generateCave({ ...options, random: mulberry32(9) });

    // then
    expect(transitions(smooth.grid)).toBeLessThan(transitions(raw.grid) / 2);
  });

  it('honors the neighborhood', () => {
    // given
    const options = { width: 40, height: 30 };

    // when
    const moore = generateCave({ ...options, random: mulberry32(4) });
    const neumann = generateCave({
      ...options,
      neighborhood: 'von-neumann',
      random: mulberry32(4),
    });

    // then
    expect(moore.grid.toString()).not.toBe(neumann.grid.toString());
  });

  it('turns everything into floor when the limits can never be reached', () => {
    // given
    const options = {
      width: 20,
      height: 20,
      birthLimit: 9,
      survivalLimit: 9,
      borderWalls: false,
      random: mulberry32(1),
    };

    // when
    const { grid } = generateCave(options);

    // then
    expect(countTiles(grid, Tile.Wall)).toBe(0);
  });

  it('does not require a random source', () => {
    // given
    const options = { width: 10, height: 10 };

    // when
    const { grid } = generateCave(options);

    // then
    expect(grid.width).toBe(10);
  });

  it.each([
    ['width', { width: 0, height: 10 }],
    ['height', { width: 10, height: 2.5 }],
    ['fillChance', { width: 10, height: 10, fillChance: 1.5 }],
    ['iterations', { width: 10, height: 10, iterations: -1 }],
    ['birthLimit', { width: 10, height: 10, birthLimit: 1.5 }],
    ['survivalLimit', { width: 10, height: 10, survivalLimit: -1 }],
  ])('throws a RangeError for an invalid %s', (name, options) => {
    // given
    const generate = () => generateCave(options);

    // when / then
    expect(generate).toThrow(RangeError);
    expect(generate).toThrow(name);
  });

  it('uses lower default limits for the von Neumann neighborhood', () => {
    // given
    const options = {
      width: 50,
      height: 30,
      neighborhood: 'von-neumann',
    } as const;

    // when
    const byDefault = generateCave({ ...options, random: mulberry32(1) });
    const explicit = generateCave({
      ...options,
      birthLimit: 3,
      survivalLimit: 2,
      random: mulberry32(1),
    });

    // then
    expect(byDefault.grid.toString()).toBe(explicit.grid.toString());
    expect(countTiles(byDefault.grid, Tile.Wall)).toBeGreaterThan(300);
  });

  it('reports the regions of the map, largest first', () => {
    // given
    const options = {
      width: 60,
      height: 40,
      connect: 'none',
      random: mulberry32(2),
    } as const;

    // when
    const { regions } = generateCave(options);

    // then
    const sizes = regions.map((region) => region.size);
    expect(sizes.length).toBeGreaterThan(1);
    expect(sizes).toEqual([...sizes].sort((a, b) => b - a));
  });

  it('reports regions that add up to every floor tile', () => {
    // given
    const options = { width: 60, height: 40, random: mulberry32(2) };

    // when
    const { grid, regions } = generateCave(options);

    // then
    const total = regions.reduce((sum, region) => sum + region.size, 0);
    expect(total).toBe(countTiles(grid, Tile.Floor));
  });

  it('reports a floor tile as the center of every region', () => {
    // given
    const options = { width: 60, height: 40, random: mulberry32(2) };

    // when
    const { grid, regions } = generateCave(options);

    // then
    for (const { center } of regions) {
      expect(grid.get(center.x, center.y)).toBe(Tile.Floor);
    }
  });

  it('reports no regions for a map without floor', () => {
    // given
    const options = { width: 10, height: 10, fillChance: 1 };

    // when
    const { regions } = generateCave(options);

    // then
    expect(regions).toEqual([]);
  });

  it('fills in regions smaller than minRegionSize', () => {
    // given
    const options = {
      width: 60,
      height: 40,
      minRegionSize: 30,
      connect: 'none',
    } as const;

    // when
    const { regions } = generateCave({ ...options, random: mulberry32(2) });

    // then
    expect(regions.length).toBeGreaterThan(0);
    expect(regions.every((region) => region.size >= 30)).toBe(true);
  });

  it('keeps all regions without minRegionSize', () => {
    // given
    const options = { width: 60, height: 40, connect: 'none' } as const;

    // when
    const all = generateCave({ ...options, random: mulberry32(2) });
    const filtered = generateCave({
      ...options,
      minRegionSize: 30,
      random: mulberry32(2),
    });

    // then
    expect(all.regions.length).toBeGreaterThan(filtered.regions.length);
  });

  it('fills in everything but the largest region with connect largest', () => {
    // given
    const options = { width: 60, height: 40 };

    // when
    const kept = generateCave({
      ...options,
      connect: 'none',
      random: mulberry32(2),
    });
    const { grid, regions } = generateCave({
      ...options,
      connect: 'largest',
      random: mulberry32(2),
    });

    // then
    expect(regions).toHaveLength(1);
    expect(regions[0]?.size).toBe(kept.regions[0]?.size);
    expect(countTiles(grid, Tile.Floor)).toBe(kept.regions[0]?.size);
  });

  it('leaves the caverns apart with connect none', () => {
    // given
    const options = { width: 60, height: 40, connect: 'none' } as const;

    // when
    const { regions } = generateCave({ ...options, random: mulberry32(2) });

    // then
    expect(regions.length).toBeGreaterThan(1);
  });

  it('throws a RangeError for an invalid minRegionSize', () => {
    // given
    const generate = () =>
      generateCave({ width: 10, height: 10, minRegionSize: -1 });

    // when / then
    expect(generate).toThrow(RangeError);
  });
});
