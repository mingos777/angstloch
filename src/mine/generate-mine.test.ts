import { describe, expect, it } from 'vitest';
import { findCaveRegions } from '../cave/find-cave-regions';
import type { Grid } from '../core/grid';
import { Tile } from '../core/tile';
import { mulberry32 } from '../test-helpers/mulberry32';
import { generateMine } from './generate-mine';
import type { MineOptions } from './mine-options';

function floorShare(grid: Grid): number {
  return (grid.toString().split('.').length - 1) / (grid.width * grid.height);
}

/** Counts the walls that the floor shuts in, which are the ones that a loop of tunnels encloses. */
function countEnclosedWalls(grid: Grid): number {
  const reached = new Set<number>();
  const stack = [{ x: 0, y: 0 }];
  while (stack.length > 0) {
    const tile = stack.pop();
    if (!tile) {
      break;
    }
    const key = tile.y * grid.width + tile.x;
    if (!grid.inBounds(tile.x, tile.y) || reached.has(key)) {
      continue;
    }
    if (grid.get(tile.x, tile.y) !== Tile.Wall) {
      continue;
    }
    reached.add(key);
    for (let dy = -1; dy <= 1; ++dy) {
      for (let dx = -1; dx <= 1; ++dx) {
        stack.push({ x: tile.x + dx, y: tile.y + dy });
      }
    }
  }
  let walls = 0;
  for (let y = 0; y < grid.height; ++y) {
    for (let x = 0; x < grid.width; ++x) {
      walls += grid.get(x, y) === Tile.Wall ? 1 : 0;
    }
  }
  return walls - reached.size;
}

const base: MineOptions = { width: 80, height: 50 };

describe('generateMine', () => {
  it('makes a map of the requested size', () => {
    // given
    const options = { width: 70, height: 45, random: mulberry32(1) };

    // when
    const { grid } = generateMine(options);

    // then
    expect(grid.width).toBe(70);
    expect(grid.height).toBe(45);
  });

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

  it('does not change the options it is given', () => {
    // given
    const options: MineOptions = {
      ...base,
      random: mulberry32(1),
      shaftWidth: { min: 2, max: 3 },
    };
    const copy = structuredClone({ ...options, random: undefined });

    // when
    generateMine(options);

    // then
    expect({ ...options, random: undefined }).toEqual(copy);
  });

  it('keeps the ring around the map as wall', () => {
    // given
    const options = { ...base, random: mulberry32(3) };

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

  it('makes one connected piece', () => {
    // given
    const seeds = [1, 2, 3, 4, 5, 6];

    // when
    const mines = seeds.map((seed) =>
      generateMine({ ...base, random: mulberry32(seed), loops: 0.5 }),
    );

    // then
    for (const { grid } of mines) {
      expect(findCaveRegions(grid)).toHaveLength(1);
    }
  });

  it('digs tunnels until the density is reached', () => {
    // given
    const options = { ...base, density: 0.2, random: mulberry32(4) };

    // when
    const { grid } = generateMine(options);

    // then
    expect(floorShare(grid)).toBeGreaterThanOrEqual(0.2);
    expect(floorShare(grid)).toBeLessThan(0.25);
  });

  it('digs more with a higher density', () => {
    // given
    const make = (density: number) =>
      generateMine({ ...base, density, random: mulberry32(4) });

    // when
    const sparse = make(0.1);
    const dense = make(0.3);

    // then
    expect(floorShare(dense.grid)).toBeGreaterThan(floorShare(sparse.grid));
  });

  it('digs the main shaft only with a density of 0', () => {
    // given
    const options = { ...base, density: 0, random: mulberry32(1) };

    // when
    const { passages } = generateMine(options);

    // then
    expect(passages).toHaveLength(1);
    expect(passages[0]?.kind).toBe('shaft');
  });

  it('stops short when the map has no room for the density', () => {
    // given
    const options = {
      width: 20,
      height: 20,
      density: 1,
      random: mulberry32(1),
    };

    // when
    const { grid } = generateMine(options);

    // then
    expect(floorShare(grid)).toBeLessThan(1);
  });

  it('lists the main shaft first and the adits after it', () => {
    // given
    const options = { ...base, random: mulberry32(1) };

    // when
    const { passages } = generateMine(options);

    // then
    expect(passages[0]?.kind).toBe('shaft');
    expect(passages.length).toBeGreaterThan(1);
    expect(passages.slice(1).every((p) => p.kind === 'adit')).toBe(true);
  });

  it('runs a straight main shaft along a row at an angle of 0', () => {
    // given
    const options = {
      ...base,
      angle: 0,
      shaftWindiness: 0,
      density: 0,
      random: mulberry32(1),
    };

    // when
    const { passages } = generateMine(options);

    // then
    const rows = new Set(passages[0]?.tiles.map((tile) => tile.y));
    expect(rows.size).toBe(1);
  });

  it('runs a straight main shaft along a column at an angle of 90', () => {
    // given
    const options = {
      ...base,
      angle: 90,
      shaftWindiness: 0,
      density: 0,
      random: mulberry32(1),
    };

    // when
    const { passages } = generateMine(options);

    // then
    const columns = new Set(passages[0]?.tiles.map((tile) => tile.x));
    expect(columns.size).toBe(1);
  });

  it('digs the main shaft as wide as the shaft width says', () => {
    // given
    const options = {
      ...base,
      angle: 0,
      shaftWindiness: 0,
      shaftWidth: { min: 3, max: 3 },
      density: 0,
      random: mulberry32(1),
    };

    // when
    const { grid, passages } = generateMine(options);

    // then
    const middle = passages[0]?.tiles[20];
    let floors = 0;
    for (let y = 0; y < grid.height; ++y) {
      floors += grid.get(middle?.x ?? 0, y) === Tile.Floor ? 1 : 0;
    }
    expect(passages[0]?.width).toBe(3);
    expect(floors).toBe(3);
  });

  it('winds the main shaft more with a higher windiness', () => {
    // given
    const make = (shaftWindiness: number) =>
      generateMine({
        ...base,
        angle: 0,
        shaftWindiness,
        density: 0,
        random: mulberry32(2),
      }).passages[0]?.tiles;

    // when
    const straight = make(0);
    const windy = make(1);

    // then
    expect(new Set(straight?.map((tile) => tile.y)).size).toBe(1);
    expect(new Set(windy?.map((tile) => tile.y)).size).toBeGreaterThan(3);
  });

  it('keeps every adit within the length range, which counts along its line', () => {
    // given
    const options = {
      ...base,
      aditLength: { min: 10, max: 15 },
      random: mulberry32(2),
    };

    // when
    const { passages } = generateMine(options);

    // then
    const adits = passages.filter((passage) => passage.kind === 'adit');
    expect(adits.length).toBeGreaterThan(0);
    for (const { tiles } of adits) {
      expect(tiles.length).toBeGreaterThanOrEqual(10);
      expect(tiles.length).toBeLessThanOrEqual(23);
    }
  });

  it('digs the adits with a width from the adit width range', () => {
    // given
    const options = {
      ...base,
      aditWidth: { min: 1, max: 1 },
      random: mulberry32(2),
    };

    // when
    const { passages } = generateMine(options);

    // then
    const adits = passages.filter((passage) => passage.kind === 'adit');
    expect(adits.every((adit) => adit.width === 1)).toBe(true);
  });

  it('digs floor along every tunnel', () => {
    // given
    const options = { ...base, random: mulberry32(6) };

    // when
    const { grid, passages } = generateMine(options);

    // then
    for (const { tiles } of passages) {
      for (const tile of tiles) {
        const inside =
          tile.x >= 1 &&
          tile.y >= 1 &&
          tile.x < grid.width - 1 &&
          tile.y < grid.height - 1;
        expect(!inside || grid.get(tile.x, tile.y) === Tile.Floor).toBe(true);
      }
    }
  });

  it('ends adits in dead ends, with no loops, by default', () => {
    // given
    const seeds = [1, 2, 3, 4, 5];

    // when
    const mines = seeds.map((seed) =>
      generateMine({ ...base, random: mulberry32(seed) }),
    );

    // then
    for (const { grid } of mines) {
      expect(countEnclosedWalls(grid)).toBe(0);
    }
  });

  it('makes no loops when a winding shaft curves back towards its adits', () => {
    // given
    const options = {
      width: 80,
      height: 50,
      angle: 111,
      shaftWindiness: 0.75,
      aditWindiness: 0,
      random: mulberry32(3),
    };

    // when
    const { grid } = generateMine(options);

    // then
    expect(countEnclosedWalls(grid)).toBe(0);
  });

  it('keeps a shaft that winds off the map in one piece', () => {
    // given
    const seeds = Array.from({ length: 20 }, (_, i) => i + 1);

    // when
    const mines = seeds.map((seed) =>
      generateMine({
        width: 120,
        height: 20,
        angle: 0,
        shaftWindiness: 1,
        random: mulberry32(seed),
      }),
    );

    // then
    for (const { grid } of mines) {
      expect(findCaveRegions(grid)).toHaveLength(1);
    }
  });

  it('makes loops when adits break through into other tunnels', () => {
    // given
    const seeds = [1, 2, 3, 4, 5];

    // when
    const mines = seeds.map((seed) =>
      generateMine({ ...base, loops: 1, random: mulberry32(seed) }),
    );

    // then
    const enclosed = mines.map(({ grid }) => countEnclosedWalls(grid));
    expect(enclosed.every((count) => count > 0)).toBe(true);
  });

  it('adds the requested number of exits on the border', () => {
    // given
    const options = { ...base, minExits: 3, random: mulberry32(1) };

    // when
    const { grid, exits } = generateMine(options);

    // then
    expect(exits).toHaveLength(3);
    for (const { x, y } of exits) {
      expect(grid.get(x, y)).toBe(Tile.Door);
      expect(
        x === 0 || y === 0 || x === grid.width - 1 || y === grid.height - 1,
      ).toBe(true);
    }
  });

  it('keeps the mine connected with exits', () => {
    // given
    const options = { ...base, minExits: 3, random: mulberry32(1) };

    // when
    const { grid } = generateMine(options);

    // then
    expect(findCaveRegions(grid)).toHaveLength(1);
  });

  it('adds a number of exits between the minimum and the maximum', () => {
    // given
    const options = {
      ...base,
      minExits: 1,
      maxExits: 4,
      random: mulberry32(8),
    };

    // when
    const { exits } = generateMine(options);

    // then
    expect(exits.length).toBeGreaterThanOrEqual(1);
    expect(exits.length).toBeLessThanOrEqual(4);
  });

  it('adds no exits by default', () => {
    // given
    const options = { ...base, random: mulberry32(1) };

    // when
    const { exits } = generateMine(options);

    // then
    expect(exits).toEqual([]);
  });

  it('works with Math.random when no random is given', () => {
    // given
    const options = base;

    // when
    const { grid } = generateMine(options);

    // then
    expect(floorShare(grid)).toBeGreaterThan(0);
  });

  it('digs a mine on a tiny map without failing', () => {
    // given
    const options = { width: 3, height: 3, random: mulberry32(1) };

    // when
    const { grid } = generateMine(options);

    // then
    expect(grid.width).toBe(3);
  });

  it.each([
    ['width', { width: 0 }],
    ['height', { height: -1 }],
    ['width', { width: 1.5 }],
    ['layout', { layout: 'spiral' as 'fishbone' }],
    ['angle', { angle: Number.NaN }],
    ['density', { density: 1.5 }],
    ['shaftWindiness', { shaftWindiness: -0.1 }],
    ['aditWindiness', { aditWindiness: 2 }],
    ['loops', { loops: 1.1 }],
    ['shaftWidth', { shaftWidth: { min: 0, max: 2 } }],
    ['aditWidth', { aditWidth: { min: 3, max: 2 } }],
    ['aditLength', { aditLength: { min: 1.5, max: 4 } }],
    ['branchAngle', { branchAngle: { min: 10, max: 180 } }],
    ['branchAngle', { branchAngle: { min: 0, max: 90 } }],
    ['minExits', { minExits: -1 }],
    ['maxExits', { maxExits: 1.5 }],
  ])('throws a RangeError for an invalid %s', (_name, invalid) => {
    // given
    const options = { ...base, ...invalid };

    // when
    const generate = () => generateMine(options);

    // then
    expect(generate).toThrow(RangeError);
  });
});
