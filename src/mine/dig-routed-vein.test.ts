import { describe, expect, it } from 'vitest';
import { Grid } from '../core/grid';
import { Tile } from '../core/tile';
import { createSimplexNoise } from '../noise/create-simplex-noise';
import { mulberry32 } from '../test-helpers/mulberry32';
import { digRoutedVein } from './dig-routed-vein';

/** Carves a rectangle of floor. */
function carve(
  grid: Grid,
  x: number,
  y: number,
  width: number,
  height: number,
) {
  for (let ty = y; ty < y + height; ++ty) {
    for (let tx = x; tx < x + width; ++tx) {
      grid.set(tx, ty, Tile.Floor);
    }
  }
}

describe('digRoutedVein', () => {
  const noise = createSimplexNoise(mulberry32(1));
  const style = { width: 2, windiness: 0.5 };

  it('joins two halls through the rock between them', () => {
    // given
    const grid = new Grid(60, 30);
    carve(grid, 5, 8, 12, 12);
    carve(grid, 40, 8, 12, 12);

    // when
    const vein = digRoutedVein(
      grid,
      noise,
      { x: 16, y: 12 },
      { x: 40, y: 15 },
      style,
      0.5,
    );

    // then
    expect(vein?.passage.kind).toBe('vein');
    expect(vein?.passage.tiles[0]).toEqual({ x: 16, y: 12 });
    expect(vein?.passage.tiles.at(-1)).toEqual({ x: 40, y: 15 });
    expect(
      grid.get(28, 13) === Tile.Floor ||
        grid.get(28, 14) === Tile.Floor ||
        grid.get(28, 12) === Tile.Floor,
    ).toBe(true);
  });

  it('lists the tiles of floor that it made, and only those', () => {
    // given
    const grid = new Grid(60, 30);
    carve(grid, 5, 8, 12, 12);
    carve(grid, 40, 8, 12, 12);
    const before = grid.toString();

    // when
    const vein = digRoutedVein(
      grid,
      noise,
      { x: 16, y: 12 },
      { x: 40, y: 15 },
      style,
      0.5,
    );

    // then
    const after = grid.toString().split('');
    const changed = after.flatMap((char, index) =>
      char !== before[index] ? [index] : [],
    );
    expect(vein?.carved.slice().sort((a, b) => a - b)).toEqual(
      changed.map((index) => index - Math.floor(index / 61)),
    );
  });

  it('runs around a hall that is in the way', () => {
    // given
    const grid = new Grid(80, 40);
    carve(grid, 5, 15, 10, 10);
    carve(grid, 30, 5, 20, 30);
    carve(grid, 65, 15, 10, 10);

    // when
    const vein = digRoutedVein(
      grid,
      noise,
      { x: 14, y: 20 },
      { x: 65, y: 20 },
      style,
      0.5,
    );

    // then
    const middle = vein?.passage.tiles.slice(4, -4) ?? [];
    expect(middle.length).toBeGreaterThan(0);
    expect(
      middle.every(({ x, y }) => !(x >= 30 && x < 50 && y >= 5 && y < 35)),
    ).toBe(true);
  });

  it('finds no route when a hall walls the way off', () => {
    // given
    const grid = new Grid(60, 20);
    carve(grid, 5, 8, 8, 4);
    carve(grid, 45, 8, 8, 4);
    carve(grid, 27, 1, 6, 18);

    // when
    const vein = digRoutedVein(
      grid,
      noise,
      { x: 12, y: 10 },
      { x: 45, y: 10 },
      style,
      0.5,
    );

    // then
    expect(vein).toBeUndefined();
  });

  it('carves nothing when it finds no route', () => {
    // given
    const grid = new Grid(60, 20);
    carve(grid, 5, 8, 8, 4);
    carve(grid, 45, 8, 8, 4);
    carve(grid, 27, 1, 6, 18);
    const before = grid.toString();

    // when
    digRoutedVein(grid, noise, { x: 12, y: 10 }, { x: 45, y: 10 }, style, 0.5);

    // then
    expect(grid.toString()).toBe(before);
  });

  it('leaves a wall between the vein and a hall it passes', () => {
    // given
    const grid = new Grid(80, 40);
    carve(grid, 5, 15, 10, 10);
    carve(grid, 30, 5, 20, 8);
    carve(grid, 65, 15, 10, 10);

    // when
    const vein = digRoutedVein(
      grid,
      noise,
      { x: 14, y: 20 },
      { x: 65, y: 20 },
      { width: 1, windiness: 0 },
      0.5,
    );

    // then
    const middle = vein?.passage.tiles.slice(4, -4) ?? [];
    expect(middle.every(({ y }) => y > 14)).toBe(true);
  });

  it('finds no route that goes much further round than the way between the ends', () => {
    // given
    const grid = new Grid(80, 60);
    carve(grid, 5, 25, 8, 10);
    carve(grid, 60, 25, 8, 10);
    carve(grid, 25, 10, 20, 40);

    // when
    const vein = digRoutedVein(
      grid,
      noise,
      { x: 12, y: 30 },
      { x: 60, y: 30 },
      style,
      0.5,
    );

    // then
    expect(vein).toBeUndefined();
  });

  it('digs that same vein when relaxed, whatever the length', () => {
    // given
    const grid = new Grid(80, 60);
    carve(grid, 5, 25, 8, 10);
    carve(grid, 60, 25, 8, 10);
    carve(grid, 25, 10, 20, 40);

    // when
    const vein = digRoutedVein(
      grid,
      noise,
      { x: 12, y: 30 },
      { x: 60, y: 30 },
      style,
      0.5,
      true,
    );

    // then
    expect(vein?.passage.tiles.length).toBeGreaterThan(80);
  });

  it('squeezes through a gap of one tile when relaxed', () => {
    // given
    const grid = new Grid(40, 20);
    carve(grid, 5, 5, 10, 10);
    carve(grid, 17, 1, 1, 9);
    carve(grid, 17, 11, 1, 8);
    carve(grid, 20, 5, 10, 10);
    const narrow = { width: 1, windiness: 0 };

    // when
    const strict = digRoutedVein(
      grid,
      noise,
      { x: 14, y: 10 },
      { x: 20, y: 10 },
      narrow,
      0.5,
    );
    const relaxed = digRoutedVein(
      grid,
      noise,
      { x: 14, y: 10 },
      { x: 20, y: 10 },
      narrow,
      0.5,
      true,
    );

    // then
    expect(strict).toBeUndefined();
    expect(relaxed).toBeDefined();
  });
});
