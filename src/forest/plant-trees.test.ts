import { describe, expect, it } from 'vitest';
import { Tile } from '../core/tile';
import { emptyMap } from '../pipeline/empty-map';
import { pipeline } from '../pipeline/pipeline';
import { mulberry32 } from '../test-helpers/mulberry32';
import { plantTrees } from './plant-trees';

const base = emptyMap({ width: 30, height: 20, tile: Tile.Grass });

function count(
  grid: { width: number; height: number; get(x: number, y: number): Tile },
  tile: Tile,
) {
  let total = 0;
  for (let y = 0; y < grid.height; ++y) {
    for (let x = 0; x < grid.width; ++x) {
      total += grid.get(x, y) === tile ? 1 : 0;
    }
  }
  return total;
}

describe('plantTrees', () => {
  it('plants trees on grass', () => {
    // given
    const step = plantTrees({ density: { min: 0.2, max: 0.2 } });

    // when
    const { grid } = pipeline(base, [step], { random: mulberry32(1) });

    // then
    const trees = count(grid, Tile.Tree);
    expect(trees).toBeGreaterThan(60);
    expect(trees).toBeLessThan(180);
  });

  it('plants only on tiles that hold the base tile', () => {
    // given
    const state = base();
    for (let y = 0; y < state.grid.height; ++y) {
      state.grid.set(5, y, Tile.Road);
    }

    // when
    plantTrees({ density: { min: 1, max: 1 } })(state, {
      random: mulberry32(1),
    });

    // then
    for (let y = 0; y < state.grid.height; ++y) {
      expect(state.grid.get(5, y)).toBe(Tile.Road);
      expect(state.grid.get(4, y)).toBe(Tile.Tree);
    }
  });

  it('marks what it plants as prunable, and nothing else', () => {
    // given
    const state = base();
    state.grid.set(0, 0, Tile.Road);

    // when
    plantTrees({ density: { min: 0.3, max: 0.3 } })(state, {
      random: mulberry32(2),
    });

    // then
    const prunable = state.prunable.reduce((sum, byte) => sum + byte, 0);
    expect(prunable).toBe(count(state.grid, Tile.Tree));
    expect(state.prunable[0]).toBe(0);
    state.prunable.forEach((byte, at) => {
      expect(byte === 1).toBe(
        state.grid.get(at % 30, Math.floor(at / 30)) === Tile.Tree,
      );
    });
  });

  it('plants nothing when the density is 0', () => {
    // given
    const step = plantTrees({ density: { min: 0, max: 0 } });

    // when
    const { grid } = pipeline(base, [step]);

    // then
    expect(count(grid, Tile.Tree)).toBe(0);
  });

  it('plants every base tile when the density is 1', () => {
    // given
    const step = plantTrees({ density: { min: 1, max: 1 } });

    // when
    const { grid } = pipeline(base, [step]);

    // then
    expect(count(grid, Tile.Tree)).toBe(30 * 20);
  });

  it('plants at the density of min where the noise is at its lowest', () => {
    // given
    const step = plantTrees({ noise: () => -1, density: { min: 0, max: 1 } });

    // when
    const { grid } = pipeline(base, [step]);

    // then
    expect(count(grid, Tile.Tree)).toBe(0);
  });

  it('plants at the density of max where the noise is at its highest', () => {
    // given
    const step = plantTrees({ noise: () => 1, density: { min: 0, max: 1 } });

    // when
    const { grid } = pipeline(base, [step]);

    // then
    expect(count(grid, Tile.Tree)).toBe(30 * 20);
  });

  it('plants the tile it is given, on any base', () => {
    // given
    const dirt = emptyMap({ width: 10, height: 10, tile: Tile.Floor });
    const step = plantTrees({ tile: Tile.Wall, density: { min: 1, max: 1 } });

    // when
    const { grid, base: ground } = pipeline(dirt, [step]);

    // then
    expect(ground).toBe(Tile.Floor);
    expect(count(grid, Tile.Wall)).toBe(100);
  });

  it('gives the same forest for the same seed', () => {
    // given
    const step = plantTrees();

    // when
    const first = pipeline(base, [step], { random: mulberry32(9) });
    const second = pipeline(base, [step], { random: mulberry32(9) });

    // then
    expect(first.grid.toString()).toBe(second.grid.toString());
  });

  it('gives a different forest for another seed', () => {
    // given
    const step = plantTrees({ density: { min: 0.3, max: 0.3 } });

    // when
    const first = pipeline(base, [step], { random: mulberry32(1) });
    const second = pipeline(base, [step], { random: mulberry32(2) });

    // then
    expect(first.grid.toString()).not.toBe(second.grid.toString());
  });

  it.each([
    ['density.min', { density: { min: -0.1, max: 0.2 } }],
    ['density.max', { density: { min: 0, max: 1.5 } }],
    ['density.min', { density: { min: 0.5, max: 0.2 } }],
    ['tile', { tile: 99 as Tile }],
    ['scaleX', { scaleX: 0 }],
    ['octaves', { octaves: 0 }],
    ['persistence', { persistence: 2 }],
  ])('throws a RangeError at once for a bad %s', (_name, options) => {
    // given
    const bad = options;

    // when
    const call = () => plantTrees(bad);

    // then
    expect(call).toThrow(RangeError);
  });
});
