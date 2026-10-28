import { describe, expect, it } from 'vitest';
import type { Grid } from '../core/grid';
import { Tile } from '../core/tile';
import { plantTrees } from '../forest/plant-trees';
import { emptyMap } from '../pipeline/empty-map';
import { pipeline } from '../pipeline/pipeline';
import { mulberry32 } from '../test-helpers/mulberry32';
import { layFootbridges } from './lay-footbridges';
import type { LayFootbridgesOptions } from './lay-footbridges-options';
import { layRoads } from './lay-roads';
import { layStreams } from './lay-streams';
import type { LayStreamsOptions } from './lay-streams-options';

const base = emptyMap({ width: 80, height: 60, tile: Tile.Grass });
const solid = plantTrees({ density: { min: 1, max: 1 } });
/** A stream that runs left to right in a straight line. */
const LEVEL: LayStreamsOptions = { angle: 0, windiness: 0 };
/** A road that runs top to bottom in a straight line. */
const UPRIGHT = { angle: 90, windiness: 0, width: { min: 3, max: 3 } };

/** Dense trees, a stream, optionally a road across it, and the footbridges. */
function build(
  streams: LayStreamsOptions,
  {
    footbridges,
    road = false,
    seed = 1,
  }: {
    footbridges?: LayFootbridgesOptions;
    road?: boolean;
    seed?: number;
  } = {},
) {
  const random = { random: mulberry32(seed) };
  const bridge = layFootbridges(footbridges);
  return road
    ? pipeline(
        base,
        [solid, layStreams(streams), layRoads(UPRIGHT), bridge],
        random,
      )
    : pipeline(base, [solid, layStreams(streams), bridge], random);
}

function count(grid: Grid, tile: Tile) {
  let total = 0;
  for (let y = 0; y < grid.height; ++y) {
    for (let x = 0; x < grid.width; ++x) {
      total += grid.get(x, y) === tile ? 1 : 0;
    }
  }
  return total;
}

/** The number of pieces that the tiles of dry land and bridges make, joined along edges. */
function pieces(grid: Grid): number {
  const seen = new Set<number>();
  const walkable = (x: number, y: number) =>
    grid.inBounds(x, y) &&
    grid.get(x, y) !== Tile.ShallowWater &&
    grid.get(x, y) !== Tile.DeepWater;
  let total = 0;
  for (let y = 0; y < grid.height; ++y) {
    for (let x = 0; x < grid.width; ++x) {
      if (!walkable(x, y) || seen.has(y * grid.width + x)) {
        continue;
      }
      ++total;
      const pending = [[x, y] as const];
      seen.add(y * grid.width + x);
      for (let at = pending.pop(); at; at = pending.pop()) {
        for (const [nx, ny] of [
          [at[0] - 1, at[1]],
          [at[0] + 1, at[1]],
          [at[0], at[1] - 1],
          [at[0], at[1] + 1],
        ] as const) {
          if (walkable(nx, ny) && !seen.has(ny * grid.width + nx)) {
            seen.add(ny * grid.width + nx);
            pending.push([nx, ny]);
          }
        }
      }
    }
  }
  return total;
}

describe('layFootbridges', () => {
  it('lays a footbridge across a stream that no road crosses', () => {
    // given
    const streams = { ...LEVEL, width: { min: 2, max: 2 } };

    // when
    const { grid, bridges } = build(streams);

    // then
    expect(bridges).toHaveLength(1);
    const [bridge] = bridges;
    expect(grid.get(bridge?.x ?? -1, bridge?.y ?? -1)).toBe(Tile.Bridge);
  });

  it('joins the land that the stream cuts in two', () => {
    // given
    const streams = { ...LEVEL, width: { min: 3, max: 3 } };

    // when
    const { grid } = build(streams);

    // then
    expect(pieces(grid)).toBe(1);
  });

  it('makes a footbridge one tile wide, across the whole stream', () => {
    // given
    const streams = { ...LEVEL, width: { min: 3, max: 3 } };

    // when
    const { grid } = build(streams);

    // then
    expect(count(grid, Tile.Bridge)).toBe(3);
  });

  it('clears the prunable bit of the tiles it stamps', () => {
    // given
    const streams = { ...LEVEL, width: { min: 2, max: 2 } };

    // when
    const { grid, prunable } = build(streams);

    // then
    for (let at = 0; at < prunable.length; ++at) {
      if (grid.get(at % 80, Math.floor(at / 80)) === Tile.Bridge) {
        expect(prunable[at]).toBe(0);
      }
    }
  });

  it('lays none across a stream 1 tile wide', () => {
    // given
    const streams = { ...LEVEL, width: { min: 1, max: 1 } };

    // when
    const { bridges } = build(streams);

    // then
    expect(bridges).toEqual([]);
  });

  it('lays no footbridge when a road crosses the stream', () => {
    // given
    const streams = LEVEL;

    // when
    const { bridges } = build(streams, { road: true });

    // then
    expect(bridges).toHaveLength(1);
  });

  it('reports the bridge of a road even when it lays no footbridge', () => {
    // given
    const streams = LEVEL;
    const { bridges: roadBridges } = pipeline(
      base,
      [solid, layStreams(streams), layRoads(UPRIGHT)],
      { random: mulberry32(1) },
    );

    // when
    const { bridges } = build(streams, { road: true });

    // then
    expect(bridges).toEqual(roadBridges);
  });

  it('lays no footbridge across a stream that has a spring', () => {
    // given
    const streams = { ...LEVEL, spring: true };

    // when
    const { grid, bridges } = build(streams);

    // then
    expect(bridges).toEqual([]);
    expect(count(grid, Tile.Bridge)).toBe(0);
  });

  it('lays footbridges up to the minimum', () => {
    // given
    const footbridges = { minimum: 3 };

    // when
    const { bridges } = build(LEVEL, { footbridges });

    // then
    expect(bridges).toHaveLength(3);
  });

  it('counts the bridges of roads towards the minimum', () => {
    // given
    const footbridges = { minimum: 3 };

    // when
    const { bridges } = build(LEVEL, { footbridges, road: true });

    // then
    expect(bridges).toHaveLength(3);
  });

  it('never lays a footbridge on the edge of the map', () => {
    // given
    const streams = {
      ...LEVEL,
      width: { min: 3, max: 3 },
      tributaries: { min: 2, max: 2 },
    };
    const footbridges = { minimum: 6 };

    // when
    const grids = [1, 2, 3, 4, 5, 6].map(
      (seed) => build(streams, { footbridges, seed }).grid,
    );

    // then
    for (const grid of grids) {
      for (let x = 0; x < grid.width; ++x) {
        expect(grid.get(x, 0)).not.toBe(Tile.Bridge);
        expect(grid.get(x, grid.height - 1)).not.toBe(Tile.Bridge);
      }
      for (let y = 0; y < grid.height; ++y) {
        expect(grid.get(0, y)).not.toBe(Tile.Bridge);
        expect(grid.get(grid.width - 1, y)).not.toBe(Tile.Bridge);
      }
    }
  });

  it('stamps the bridge tile it is given', () => {
    // given
    const footbridges = { bridgeTile: Tile.Door };
    const streams = { ...LEVEL, width: { min: 2, max: 2 } };

    // when
    const { grid } = build(streams, { footbridges });

    // then
    expect(count(grid, Tile.Door)).toBe(2);
    expect(count(grid, Tile.Bridge)).toBe(0);
  });

  it('is deterministic for the same seed', () => {
    // given
    const streams = { ...LEVEL, width: { min: 2, max: 3 } };
    const footbridges = { minimum: 2 };

    // when
    const a = build(streams, { footbridges, seed: 5 });
    const b = build(streams, { footbridges, seed: 5 });

    // then
    expect(a.grid.toString()).toBe(b.grid.toString());
    expect(a.bridges).toEqual(b.bridges);
  });

  it('throws a TypeError without streams in the state', () => {
    // given
    const run = () => pipeline(base, [layFootbridges() as never]);

    // then
    expect(run).toThrow(TypeError);
  });

  it('throws a RangeError for a bad minimum or bridge tile', () => {
    // given
    const badMinimum = () => layFootbridges({ minimum: 1.5 });
    const badTile = () => layFootbridges({ bridgeTile: 99 as Tile });

    // then
    expect(badMinimum).toThrow(RangeError);
    expect(badTile).toThrow(RangeError);
  });
});
