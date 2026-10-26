import { describe, expect, it } from 'vitest';
import type { Area } from '../core/area';
import { Grid } from '../core/grid';
import type { Point } from '../core/point';
import { Tile } from '../core/tile';
import { createSimplexNoise } from '../noise/create-simplex-noise';
import { mulberry32 } from '../test-helpers/mulberry32';
import { growHallNetwork } from './grow-hall-network';
import type { HallNetworkSettings } from './grow-hall-network';

/** Carves rectangular halls of floor and returns them with their floor tiles. */
function carveHalls(grid: Grid, areas: Area[]) {
  const floors: Point[][] = areas.map((area) => {
    const tiles: Point[] = [];
    for (let y = area.y; y < area.y + area.height; ++y) {
      for (let x = area.x; x < area.x + area.width; ++x) {
        grid.set(x, y, Tile.Floor);
        tiles.push({ x, y });
      }
    }
    return tiles;
  });
  return { halls: areas, floors };
}

const settings: HallNetworkSettings = {
  hallVeins: { min: 1, max: 1 },
  hallEntrances: 'facing',
  veinWidth: { min: 1, max: 2 },
  veinWindiness: 0.5,
};

const grow = (
  grid: Grid,
  halls: Area[],
  floors: Point[][],
  override: Partial<HallNetworkSettings> = {},
  seed = 1,
) =>
  growHallNetwork(
    grid,
    mulberry32(seed),
    createSimplexNoise(mulberry32(seed + 100)),
    halls,
    floors,
    { ...settings, ...override },
  );

describe('growHallNetwork', () => {
  it('digs nothing without halls', () => {
    // given
    const grid = new Grid(40, 30);

    // when
    const { passages, joined } = grow(grid, [], []);

    // then
    expect(passages).toEqual([]);
    expect(joined.size).toBe(0);
  });

  it('digs nothing for a single hall', () => {
    // given
    const grid = new Grid(40, 30);
    const { halls, floors } = carveHalls(grid, [
      { x: 10, y: 10, width: 10, height: 8 },
    ]);

    // when
    const { passages, joined } = grow(grid, halls, floors, {
      hallVeins: { min: 5, max: 5 },
    });

    // then
    expect(passages).toEqual([]);
    expect([...joined]).toEqual([0]);
  });

  it('joins two halls with a vein that starts and ends on their boundaries', () => {
    // given
    const grid = new Grid(60, 30);
    const { halls, floors } = carveHalls(grid, [
      { x: 5, y: 8, width: 12, height: 12 },
      { x: 40, y: 8, width: 12, height: 12 },
    ]);

    // when
    const { passages, joined } = grow(grid, halls, floors);

    // then
    expect(joined.size).toBe(2);
    expect(passages).toHaveLength(1);
    const tiles = passages[0]?.tiles ?? [];
    expect(tiles[0]?.x).toBe(16);
    expect(tiles[tiles.length - 1]?.x).toBe(40);
  });

  it('joins every hall with one vein at least, whatever hall veins says', () => {
    // given
    const grid = new Grid(100, 40);
    const { halls, floors } = carveHalls(grid, [
      { x: 5, y: 10, width: 12, height: 12 },
      { x: 40, y: 10, width: 12, height: 12 },
      { x: 75, y: 10, width: 12, height: 12 },
    ]);

    // when
    const { passages, joined } = grow(grid, halls, floors, {
      hallVeins: { min: 1, max: 1 },
    });

    // then
    expect(joined.size).toBe(3);
    expect(passages).toHaveLength(2);
  });

  it('digs extra veins up to hall veins, between halls that are joined already', () => {
    // given
    const grid = new Grid(80, 60);
    const { halls, floors } = carveHalls(grid, [
      { x: 5, y: 10, width: 14, height: 40 },
      { x: 50, y: 10, width: 14, height: 40 },
    ]);

    // when
    const { passages } = grow(grid, halls, floors, {
      hallVeins: { min: 4, max: 4 },
    });

    // then
    expect(passages).toHaveLength(4);
  });

  it('ends a vein on another vein when that is nearer than a hall', () => {
    // given
    const grid = new Grid(80, 50);
    const { halls, floors } = carveHalls(grid, [
      { x: 5, y: 5, width: 20, height: 4 },
      { x: 45, y: 5, width: 20, height: 4 },
      { x: 31, y: 30, width: 8, height: 4 },
    ]);

    // when
    const { passages, joined } = grow(grid, halls, floors);

    // then
    expect(joined.size).toBe(3);
    const joinsC = passages.find((passage) => passage.tiles[0]?.y === 30);
    const end = joinsC?.tiles[joinsC.tiles.length - 1];
    expect(end?.y).toBeLessThan(14);
    expect(end?.x).toBeGreaterThan(25);
    expect(end?.x).toBeLessThan(45);
  });

  it('keeps every vein within the detour limit', () => {
    // given
    const grid = new Grid(120, 60);
    const { halls, floors } = carveHalls(grid, [
      { x: 5, y: 10, width: 25, height: 40 },
      { x: 50, y: 10, width: 25, height: 40 },
      { x: 90, y: 10, width: 25, height: 40 },
    ]);

    // when
    const { passages } = grow(grid, halls, floors, {
      hallVeins: { min: 5, max: 5 },
      hallEntrances: 'edge',
    });

    // then
    for (const { tiles } of passages) {
      const first = tiles[0] as Point;
      const last = tiles[tiles.length - 1] as Point;
      const distance = Math.abs(first.x - last.x) + Math.abs(first.y - last.y);
      // a little more than the limit on the route, which the wobble and the ends add to
      expect(tiles.length).toBeLessThanOrEqual(1.8 * distance + 14);
    }
  });

  it('joins a hall that is boxed in, through a gap that only a relaxed vein fits', () => {
    // given
    const grid = new Grid(40, 20);
    const { halls, floors } = carveHalls(grid, [
      { x: 5, y: 5, width: 10, height: 10 },
      { x: 20, y: 5, width: 10, height: 10 },
    ]);
    for (let y = 1; y < 19; ++y) {
      if (y !== 10) {
        grid.set(17, y, Tile.Floor);
      }
    }

    // when
    const { passages, joined } = grow(grid, halls, floors, {
      veinWidth: { min: 1, max: 1 },
      veinWindiness: 0,
    });

    // then
    expect(joined.size).toBe(2);
    expect(passages).toHaveLength(1);
  });

  it('leaves a hall out of the network when nothing can reach it', () => {
    // given
    const grid = new Grid(40, 20);
    const { halls, floors } = carveHalls(grid, [
      { x: 5, y: 5, width: 8, height: 8 },
      { x: 25, y: 5, width: 8, height: 8 },
    ]);
    for (let y = 0; y < 20; ++y) {
      grid.set(17, y, Tile.Floor);
    }

    // when
    const { passages, joined } = grow(grid, halls, floors);

    // then
    expect(passages).toEqual([]);
    expect(joined.size).toBe(1);
  });

  it('digs the same network for the same seed', () => {
    // given
    const make = () => {
      const grid = new Grid(100, 40);
      const { halls, floors } = carveHalls(grid, [
        { x: 5, y: 10, width: 12, height: 12 },
        { x: 40, y: 10, width: 12, height: 12 },
        { x: 75, y: 10, width: 12, height: 12 },
      ]);
      grow(grid, halls, floors, { hallVeins: { min: 4, max: 4 } }, 7);
      return grid.toString();
    };

    // when
    const first = make();
    const second = make();

    // then
    expect(first).toBe(second);
  });
});
