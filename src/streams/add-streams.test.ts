import { describe, expect, it } from 'vitest';
import { Tile } from '../core/tile';
import { emptyMap } from '../pipeline/empty-map';
import { pipeline } from '../pipeline/pipeline';
import { step } from '../pipeline/step';
import { plantTrees } from '../forest/plant-trees';
import { mulberry32 } from '../test-helpers/mulberry32';
import { addStreams } from './add-streams';

const base = emptyMap({ width: 60, height: 40, tile: Tile.Grass });

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

describe('addStreams', () => {
  it('paints shallow water along the stream', () => {
    // given
    const step = addStreams({
      angle: 0,
      windiness: 0,
      width: { min: 2, max: 2 },
    });

    // when
    const { grid } = pipeline(base, [step], { random: mulberry32(1) });

    // then
    expect(count(grid, Tile.ShallowWater)).toBe(120);
    expect(count(grid, Tile.DeepWater)).toBe(0);
  });

  it('puts deep water in the core of a wide stream', () => {
    // given
    const step = addStreams({
      angle: 0,
      windiness: 0,
      width: { min: 5, max: 5 },
    });

    // when
    const { grid } = pipeline(base, [step], { random: mulberry32(1) });

    // then
    expect(count(grid, Tile.DeepWater)).toBe(180);
    expect(count(grid, Tile.ShallowWater)).toBe(120);
  });

  it('uses the tiles it is given', () => {
    // given
    const step = addStreams({
      angle: 0,
      windiness: 0,
      width: { min: 5, max: 5 },
      shallowTile: Tile.Floor,
      deepTile: Tile.Wall,
    });

    // when
    const { grid } = pipeline(base, [step], { random: mulberry32(1) });

    // then
    expect(count(grid, Tile.Floor)).toBe(120);
    expect(count(grid, Tile.Wall)).toBe(180);
  });

  it('reports the streams, tributaries running with the water', () => {
    // given
    const step = addStreams({ tributaries: { min: 2, max: 2 } });

    // when
    const { streams } = pipeline(base, [step], { random: mulberry32(3) });

    // then
    expect(streams.map(({ kind }) => kind)).toEqual([
      'road',
      'branch',
      'branch',
    ]);
  });

  it('paints over what is there and clears its prunable bit', () => {
    // given
    const plant = plantTrees({ density: { min: 1, max: 1 } });
    const water = addStreams({
      angle: 0,
      windiness: 0,
      width: { min: 2, max: 2 },
    });

    // when
    const result = pipeline(base, [plant, water], { random: mulberry32(1) });

    // then
    expect(count(result.grid, Tile.Tree)).toBe(60 * 40 - 120);
    expect(result.prunable.reduce((sum, byte) => sum + byte, 0)).toBe(
      60 * 40 - 120,
    );
  });

  it('leaves the trees at the water by default', () => {
    // given
    const plant = plantTrees({ density: { min: 1, max: 1 } });
    const water = addStreams({
      angle: 0,
      windiness: 0,
      width: { min: 1, max: 1 },
    });

    // when
    const { grid, streams } = pipeline(base, [plant, water], {
      random: mulberry32(1),
    });

    // then
    const y = streams[0]?.points[20]?.y ?? 0;
    expect(grid.get(20, y + 1)).toBe(Tile.Tree);
    expect(grid.get(20, y - 1)).toBe(Tile.Tree);
  });

  it('clears the trees within the clearance beside the water', () => {
    // given
    const plant = plantTrees({ density: { min: 1, max: 1 } });
    const water = addStreams({
      angle: 0,
      windiness: 0,
      width: { min: 1, max: 1 },
      clearance: 3,
    });

    // when
    const { grid, streams } = pipeline(base, [plant, water], {
      random: mulberry32(1),
    });

    // then
    const y = streams[0]?.points[20]?.y ?? 0;
    for (let dy = -3; dy <= 3; ++dy) {
      expect(grid.get(20, y + dy)).not.toBe(Tile.Tree);
    }
    expect(grid.get(20, y + 4)).toBe(Tile.Tree);
    expect(grid.get(20, y - 4)).toBe(Tile.Tree);
  });

  it('thins the trees across the falloff', () => {
    // given
    const plant = plantTrees({ density: { min: 1, max: 1 } });
    const water = addStreams({
      angle: 0,
      windiness: 0,
      width: { min: 1, max: 1 },
      falloff: 3,
    });

    // when
    const { grid, streams } = pipeline(base, [plant, water], {
      random: mulberry32(1),
    });

    // then
    const y = streams[0]?.points[0]?.y ?? 0;
    const near = Array.from(
      { length: 60 },
      (_, x) => grid.get(x, y + 1) === Tile.Tree,
    );
    const far = Array.from(
      { length: 60 },
      (_, x) => grid.get(x, y + 4) === Tile.Tree,
    );
    expect(near.filter(Boolean).length).toBeLessThan(
      far.filter(Boolean).length,
    );
  });

  it('throws when roads are already in the state, without retrying', () => {
    // given
    let calls = 0;
    const roads = step<object, { roads: number[] }>(
      'roads',
      { adds: ['roads'] },
      () => ({ roads: [] }),
    );
    const water = addStreams();
    const counting = step('counting', {}, () => {
      ++calls;
      return {};
    });

    // when
    const call = () => pipeline(base, [counting, roads, water]);

    // then
    expect(call).toThrow(/must come before/);
    expect(calls).toBe(1);
  });

  it('gives the same stream for the same seed', () => {
    // given
    const water = addStreams({ tributaries: { min: 1, max: 1 } });

    // when
    const first = pipeline(base, [water], { random: mulberry32(8) });
    const second = pipeline(base, [water], { random: mulberry32(8) });

    // then
    expect(first.grid.toString()).toBe(second.grid.toString());
  });

  it.each([
    ['windiness', { windiness: 2 }],
    ['streams.width', { width: { min: 0, max: 1 } }],
    ['shallowTile', { shallowTile: 99 as Tile }],
    ['deepTile', { deepTile: 99 as Tile }],
    ['addStreams.clearance', { clearance: -1 }],
    ['addStreams.falloff', { falloff: 0.5 }],
  ])('throws a RangeError at once for a bad %s', (_name, options) => {
    // given
    const bad = options;

    // when
    const call = () => addStreams(bad);

    // then
    expect(call).toThrow(RangeError);
  });
});
