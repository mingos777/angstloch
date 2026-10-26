import { describe, expect, it } from 'vitest';
import { Grid } from '../core/grid';
import { Tile } from '../core/tile';
import { createSimplexNoise } from '../noise/create-simplex-noise';
import { mulberry32 } from '../test-helpers/mulberry32';
import { brushOffsets } from '../roads/brush-offsets';
import { carvePassage } from './carve-passage';

const noise = createSimplexNoise(mulberry32(7));

function countFloor(grid: Grid): number {
  return grid.toString().split('.').length - 1;
}

describe('carvePassage', () => {
  it('carves a straight passage from a tile in a direction', () => {
    // given
    const grid = new Grid(20, 9);

    // when
    const passage = carvePassage(grid, noise, {
      from: { x: 2, y: 4 },
      angle: 0,
      length: 10,
      width: 1,
      windiness: 0,
      lane: 0,
    });

    // then
    expect(passage.tiles).toHaveLength(11);
    for (let x = 2; x <= 12; ++x) {
      expect(grid.get(x, 4)).toBe(Tile.Floor);
    }
    expect(countFloor(grid)).toBe(11);
  });

  it('stops where the length ends', () => {
    // given
    const grid = new Grid(20, 9);

    // when
    carvePassage(grid, noise, {
      from: { x: 2, y: 4 },
      angle: 0,
      length: 5,
      width: 1,
      windiness: 0,
      lane: 0,
    });

    // then
    expect(grid.get(7, 4)).toBe(Tile.Floor);
    expect(grid.get(8, 4)).toBe(Tile.Wall);
  });

  it('runs to the edge of the map without a length', () => {
    // given
    const grid = new Grid(20, 9);

    // when
    carvePassage(grid, noise, {
      from: { x: 2, y: 4 },
      angle: 0,
      width: 1,
      windiness: 0,
      lane: 0,
    });

    // then
    expect(grid.get(19, 4)).toBe(Tile.Floor);
  });

  it('carves a band as wide as the width', () => {
    // given
    const grid = new Grid(20, 11);

    // when
    carvePassage(grid, noise, {
      from: { x: 2, y: 5 },
      angle: 0,
      length: 10,
      width: 3,
      windiness: 0,
      lane: 0,
    });

    // then
    for (let y = 4; y <= 6; ++y) {
      expect(grid.get(8, y)).toBe(Tile.Floor);
    }
    expect(grid.get(8, 3)).toBe(Tile.Wall);
    expect(grid.get(8, 7)).toBe(Tile.Wall);
  });

  it('carves the brush shape around every tile of a wide passage', () => {
    // given
    const grid = new Grid(20, 20);

    // when
    const passage = carvePassage(grid, noise, {
      from: { x: 3, y: 10 },
      angle: 0,
      length: 12,
      width: 4,
      windiness: 0,
      lane: 0,
    });

    // then
    for (const tile of passage.tiles) {
      for (const offset of brushOffsets(4)) {
        expect(grid.get(tile.x + offset.x, tile.y + offset.y)).toBe(Tile.Floor);
      }
    }
  });

  it('starts and ends on the given tiles when it goes between two tiles', () => {
    // given
    const grid = new Grid(40, 40);
    const from = { x: 4, y: 5 };
    const to = { x: 33, y: 28 };

    // when
    const passage = carvePassage(grid, noise, {
      from,
      to,
      width: 1,
      windiness: 1,
      lane: 3,
    });

    // then
    expect(passage.tiles[0]).toEqual(from);
    expect(passage.tiles[passage.tiles.length - 1]).toEqual(to);
    expect(grid.get(from.x, from.y)).toBe(Tile.Floor);
    expect(grid.get(to.x, to.y)).toBe(Tile.Floor);
  });

  it('makes every tile of the passage touch the one before it along an edge', () => {
    // given
    const grid = new Grid(40, 40);

    // when
    const { tiles } = carvePassage(grid, noise, {
      from: { x: 4, y: 5 },
      to: { x: 33, y: 28 },
      width: 1,
      windiness: 1,
      lane: 3,
    });

    // then
    for (let i = 1; i < tiles.length; ++i) {
      const before = tiles[i - 1];
      const tile = tiles[i];
      expect(
        Math.abs((tile?.x ?? 0) - (before?.x ?? 0)) +
          Math.abs((tile?.y ?? 0) - (before?.y ?? 0)),
      ).toBe(1);
    }
  });

  it('stays on one row when it is not windy', () => {
    // given
    const grid = new Grid(60, 30);

    // when
    const { tiles } = carvePassage(grid, noise, {
      from: { x: 2, y: 15 },
      angle: 0,
      length: 50,
      width: 1,
      windiness: 0,
      lane: 5,
    });

    // then
    expect(new Set(tiles.map((tile) => tile.y))).toEqual(new Set([15]));
  });

  it('strays from its row when it is windy', () => {
    // given
    const grid = new Grid(60, 30);

    // when
    const { tiles } = carvePassage(grid, noise, {
      from: { x: 2, y: 15 },
      angle: 0,
      length: 50,
      width: 1,
      windiness: 1,
      lane: 5,
    });

    // then
    expect(new Set(tiles.map((tile) => tile.y)).size).toBeGreaterThan(1);
  });

  it('leaves tiles that are not wall as they are', () => {
    // given
    const grid = new Grid(20, 9);
    grid.set(5, 4, Tile.Door);

    // when
    carvePassage(grid, noise, {
      from: { x: 2, y: 4 },
      angle: 0,
      length: 10,
      width: 1,
      windiness: 0,
      lane: 0,
    });

    // then
    expect(grid.get(5, 4)).toBe(Tile.Door);
  });

  it('skips the tiles that fall off the grid', () => {
    // given
    const grid = new Grid(20, 9);

    // when
    const carve = () =>
      carvePassage(grid, noise, {
        from: { x: 0, y: 0 },
        angle: 0,
        length: 10,
        width: 3,
        windiness: 0,
        lane: 0,
      });

    // then
    expect(carve).not.toThrow();
    expect(grid.get(5, 0)).toBe(Tile.Floor);
  });

  it('does not touch tiles away from the passage', () => {
    // given
    const grid = new Grid(20, 9);

    // when
    carvePassage(grid, noise, {
      from: { x: 2, y: 4 },
      angle: 0,
      length: 10,
      width: 1,
      windiness: 0,
      lane: 0,
    });

    // then
    expect(grid.get(2, 3)).toBe(Tile.Wall);
    expect(grid.get(1, 4)).toBe(Tile.Wall);
  });

  it('leaves the outer rings of the grid alone with a margin', () => {
    // given
    const grid = new Grid(20, 9);

    // when
    carvePassage(
      grid,
      noise,
      {
        from: { x: 2, y: 1 },
        angle: 0,
        width: 3,
        windiness: 0,
        lane: 0,
      },
      1,
    );

    // then
    expect(grid.get(10, 0)).toBe(Tile.Wall);
    expect(grid.get(10, 1)).toBe(Tile.Floor);
    expect(grid.get(19, 1)).toBe(Tile.Wall);
    expect(grid.get(18, 1)).toBe(Tile.Floor);
  });

  it('runs through the start tile in both directions', () => {
    // given
    const grid = new Grid(21, 9);

    // when
    const { tiles } = carvePassage(grid, noise, {
      from: { x: 10, y: 4 },
      angle: 0,
      directions: [-1, 1],
      length: 5,
      width: 1,
      windiness: 0,
      lane: 0,
    });

    // then
    expect(tiles).toHaveLength(11);
    expect(tiles[0]).toEqual({ x: 5, y: 4 });
    expect(tiles[10]).toEqual({ x: 15, y: 4 });
  });

  it('runs backwards when only that direction is asked for', () => {
    // given
    const grid = new Grid(21, 9);

    // when
    const { tiles } = carvePassage(grid, noise, {
      from: { x: 10, y: 4 },
      angle: 0,
      directions: [-1],
      length: 5,
      width: 1,
      windiness: 0,
      lane: 0,
    });

    // then
    expect(tiles[0]).toEqual({ x: 5, y: 4 });
    expect(tiles[tiles.length - 1]).toEqual({ x: 10, y: 4 });
  });
});
