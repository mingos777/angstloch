import { describe, expect, it } from 'vitest';
import type { Grid } from '../core/grid';
import { Tile } from '../core/tile';
import { plantTrees } from '../forest/plant-trees';
import { emptyMap } from '../pipeline/empty-map';
import { pipeline } from '../pipeline/pipeline';
import { brushOffsets } from '../roads/brush-offsets';
import { mulberry32 } from '../test-helpers/mulberry32';
import { addRoads } from './add-roads';
import type { AddRoadsOptions } from './add-roads-options';
import { addStreams } from './add-streams';
import type { AddStreamsOptions } from './add-streams-options';
import { findSpans } from './find-spans';

const base = emptyMap({ width: 80, height: 60, tile: Tile.Grass });

/** A stream that runs left to right in a straight line. */
const LEVEL: AddStreamsOptions = { angle: 0, windiness: 0 };
/** A road that runs top to bottom in a straight line. */
const UPRIGHT: AddRoadsOptions = {
  angle: 90,
  windiness: 0,
  width: { min: 3, max: 3 },
};

function count(grid: Grid, tile: Tile) {
  let total = 0;
  for (let y = 0; y < grid.height; ++y) {
    for (let x = 0; x < grid.width; ++x) {
      total += grid.get(x, y) === tile ? 1 : 0;
    }
  }
  return total;
}

/** Streams, then roads, as a forest lays them. */
function build(
  streams: AddStreamsOptions | undefined,
  roads: AddRoadsOptions,
  seed = 1,
) {
  const options = { random: mulberry32(seed) };
  return streams
    ? pipeline(base, [addStreams(streams), addRoads(roads)], options)
    : pipeline(base, [addRoads(roads)], options);
}

describe('addRoads', () => {
  it('lays a road of the width asked for', () => {
    // given
    const roads = UPRIGHT;

    // when
    const { grid } = build(undefined, roads);

    // then
    expect(count(grid, Tile.Road)).toBe(3 * 60);
  });

  it('reports the roads, junctions, exits and no bridges', () => {
    // given
    const roads = { ...UPRIGHT, crossings: { min: 1, max: 1 } };

    // when
    const result = build(undefined, roads);

    // then
    expect(result.roads).toHaveLength(2);
    expect(result.junctions.length).toBeGreaterThan(0);
    expect(result.exits.length).toBeGreaterThan(0);
    expect(result.bridges).toEqual([]);
  });

  it('reports exits on the border', () => {
    // given
    const roads = UPRIGHT;

    // when
    const { exits } = build(undefined, roads);

    // then
    expect(exits).toHaveLength(2);
    for (const { y } of exits) {
      expect([0, 59]).toContain(y);
    }
  });

  it('lays no road over the streams of another map, and no bridge without streams', () => {
    // given
    const roads = { angle: 30 };

    // when
    const { grid, bridges } = build(undefined, roads);

    // then
    expect(bridges).toEqual([]);
    expect(count(grid, Tile.Bridge)).toBe(0);
  });

  it('paints over trees and clears their prunable bit', () => {
    // given
    const plant = plantTrees({ density: { min: 1, max: 1 } });
    const roads = addRoads(UPRIGHT);

    // when
    const result = pipeline(base, [plant, roads], { random: mulberry32(1) });

    // then
    expect(count(result.grid, Tile.Tree)).toBe(80 * 60 - 3 * 60);
    expect(result.prunable.reduce((sum, byte) => sum + byte, 0)).toBe(
      80 * 60 - 3 * 60,
    );
  });

  it('keeps trees off the tiles within the clearance and thins them across the falloff', () => {
    // given
    const plant = plantTrees({ density: { min: 1, max: 1 } });
    const roads = addRoads({ ...UPRIGHT, clearance: 3 });

    // when
    const { grid, roads: laid } = pipeline(base, [plant, roads], {
      random: mulberry32(1),
    });

    // then: the brush covers one tile each side of the middle
    const x = laid[0]?.points[0]?.x ?? 0;
    for (let dx = 2; dx <= 4; ++dx) {
      expect(grid.get(x + dx, 30)).toBe(Tile.Grass);
      expect(grid.get(x - dx, 30)).toBe(Tile.Grass);
    }
    expect(grid.get(x + 5, 30)).toBe(Tile.Tree);
  });

  it('uses the tiles it is given for the road and the bridge', () => {
    // given
    const streams = { ...LEVEL, width: { min: 3, max: 3 } };
    const roads = { ...UPRIGHT, roadTile: Tile.Floor, bridgeTile: Tile.Door };

    // when
    const { grid } = build(streams, roads);

    // then
    expect(count(grid, Tile.Road)).toBe(0);
    expect(count(grid, Tile.Bridge)).toBe(0);
    expect(count(grid, Tile.Floor)).toBeGreaterThan(0);
    expect(count(grid, Tile.Door)).toBeGreaterThan(0);
  });

  it('lays a bridge where a road crosses the stream', () => {
    // given
    const streams = LEVEL;

    // when
    const { grid, bridges } = build(streams, UPRIGHT);

    // then
    expect(bridges).toHaveLength(1);
    const [bridge] = bridges;
    expect(grid.get(bridge?.x ?? -1, bridge?.y ?? -1)).toBe(Tile.Bridge);
  });

  it('makes the bridge as wide as the road and the stream', () => {
    // given
    const streams = { ...LEVEL, width: { min: 2, max: 2 } };
    const roads = { ...UPRIGHT, bridgeAngle: { min: 90, max: 90 } };

    // when
    const { grid } = build(streams, roads);

    // then
    expect(count(grid, Tile.Bridge)).toBe(6);
  });

  it('keeps the road tiles beyond the water', () => {
    // given
    const streams = LEVEL;

    // when
    const { grid } = build(streams, UPRIGHT);

    // then
    expect(count(grid, Tile.Road)).toBeGreaterThan(0);
  });

  it('leaves the water of the stream where no road crosses it', () => {
    // given
    const streams = { ...LEVEL, width: { min: 3, max: 3 } };

    // when
    const { grid } = build(streams, UPRIGHT);

    // then: the road's bridge replaces a block of 3 x 3 water tiles
    expect(count(grid, Tile.Bridge)).toBe(9);
    expect(count(grid, Tile.DeepWater) + count(grid, Tile.ShallowWater)).toBe(
      3 * 80 - 9,
    );
  });

  it('bends a road to cross the stream at the bridge angle', () => {
    // given
    const streams = LEVEL;
    const roads = {
      angle: 70,
      windiness: 0,
      bridgeAngle: { min: 90, max: 90 },
    };

    // when
    const { bridges, roads: laid } = build(streams, roads);

    // then: near the bridge the road runs straight down a column
    const [bridge] = bridges;
    const near = (laid[0]?.points ?? []).filter(
      ({ y }) => Math.abs(y - (bridge?.y ?? 0)) <= 2,
    );
    expect(new Set(near.map(({ x }) => x)).size).toBe(1);
  });

  it('does not bend the roads of exact specs, which are bridged where they cross', () => {
    // given
    const roads = {
      bridgeAngle: { min: 90, max: 90 },
      specs: [{ origin: { x: 40, y: 30 }, angle: 45, windiness: 0 }],
    };

    // when
    const { bridges, roads: laid } = build(LEVEL, roads);

    // then
    expect(bridges).toHaveLength(1);
    const [bridge] = bridges;
    const near = (laid[0]?.points ?? []).filter(
      ({ y }) => Math.abs(y - (bridge?.y ?? 0)) <= 2,
    );
    expect(new Set(near.map(({ x }) => x)).size).toBeGreaterThan(1);
  });

  it('finds a bridge for a road that crosses the stream', () => {
    // given
    const roads = {
      ...UPRIGHT,
      crossings: { min: 1, max: 1 },
      width: { min: 1, max: 1 },
    };

    // when
    const { bridges } = build(LEVEL, roads, 4);

    // then
    expect(bridges.length).toBeGreaterThanOrEqual(1);
  });

  it('lays a bridge only where a road spans the water', () => {
    // given
    const seeds = Array.from({ length: 30 }, (_, seed) => seed + 1);

    // when
    const clipped = seeds.filter((seed) => {
      const { grid } = build(
        { angle: 'random', width: { min: 3, max: 3 } },
        { angle: 'random', width: { min: 3, max: 3 } },
        seed,
      );
      const water = new Uint8Array(grid.width * grid.height);
      const bridge = new Uint8Array(grid.width * grid.height);
      for (let y = 0; y < grid.height; ++y) {
        for (let x = 0; x < grid.width; ++x) {
          const tile = grid.get(x, y);
          const at = y * grid.width + x;
          water[at] =
            tile === Tile.Bridge ||
            tile === Tile.ShallowWater ||
            tile === Tile.DeepWater
              ? 1
              : 0;
          bridge[at] = tile === Tile.Bridge ? 1 : 0;
        }
      }
      const spans = findSpans(water, bridge, grid.width, grid.height);
      return spans.some((span, at) => span !== bridge[at]);
    });

    // then
    expect(clipped).toEqual([]);
  });

  it('ends roads on land or a bridge, also where one must cross the stream near the edge', () => {
    // given
    const seeds = Array.from({ length: 30 }, (_, seed) => seed + 1);

    // when
    const wet = seeds.flatMap((seed) => {
      const { grid, roads } = build(
        { angle: 'random', width: { min: 3, max: 3 } },
        { angle: 'random' },
        seed,
      );
      return roads.flatMap(({ points }) => {
        const end = points.at(-1);
        const tile = grid.get(end?.x ?? 0, end?.y ?? 0);
        return tile === Tile.Road || tile === Tile.Bridge ? [] : [seed];
      });
    });

    // then
    expect(wet).toEqual([]);
  });

  it('makes a bridge of every tile of a generated road over water', () => {
    // given
    const seeds = Array.from({ length: 10 }, (_, seed) => seed + 1);

    // when
    const wet = seeds.flatMap((seed) => {
      const { grid, roads } = build(
        {
          width: { min: 3, max: 3 },
          tributaries: { min: 2, max: 2 },
        },
        { width: { min: 3, max: 3 } },
        seed,
      );
      return roads.flatMap(({ points, width }) =>
        points.flatMap(({ x, y }) =>
          brushOffsets(width)
            .map((offset) => grid.get(x + offset.x, y + offset.y))
            .filter(
              (tile) => tile === Tile.ShallowWater || tile === Tile.DeepWater,
            ),
        ),
      );
    });

    // then
    expect(wet).toEqual([]);
  });

  it('keeps the verge of a road apart from the verge of the bank', () => {
    // given
    const plant = plantTrees({ density: { min: 1, max: 1 } });
    const water = addStreams({ ...LEVEL, width: { min: 1, max: 1 } });
    const roads = addRoads({ ...UPRIGHT, clearance: 3 });

    // when
    const { grid, streams } = pipeline(base, [plant, water, roads], {
      random: mulberry32(1),
    });

    // then: the road keeps its trees back, the water does not
    const row = streams[0]?.points[0]?.y ?? 0;
    expect(grid.get(2, row - 1)).toBe(Tile.Tree);
  });

  it('runs without streams in the state', () => {
    // given
    const roads = { crossings: { min: 1, max: 2 } };

    // when
    const result = build(undefined, roads, 6);

    // then
    expect(result.roads.length).toBeGreaterThan(1);
  });

  it('is deterministic for the same seed', () => {
    // given
    const streams = { width: { min: 1, max: 4 } };
    const roads = { crossings: { min: 1, max: 2 } };

    // when
    const a = build(streams, roads, 5);
    const b = build(streams, roads, 5);

    // then
    expect(a.grid.toString()).toBe(b.grid.toString());
    expect(a.bridges).toEqual(b.bridges);
  });

  describe('trace', () => {
    it('reports every road as it was grown and a plan for a road that crosses', () => {
      // given
      const traced: [string, unknown][] = [];
      const steps = [addStreams(LEVEL), addRoads(UPRIGHT)] as const;

      // when
      pipeline(base, steps, {
        random: mulberry32(1),
        trace: (name, data) => traced.push([name, data]),
      });

      // then
      expect(traced).toHaveLength(1);
      const [name, data] = traced[0] ?? [];
      const { grown, plans } = data as { grown: unknown[]; plans: unknown[] };
      expect(name).toBe('addRoads');
      expect(grown).toHaveLength(1);
      expect(plans).toHaveLength(1);
    });

    it('reports no plans without streams', () => {
      // given
      const traced: unknown[] = [];

      // when
      pipeline(base, [addRoads({ crossings: { min: 1, max: 1 } })], {
        random: mulberry32(1),
        trace: (_name, data) => traced.push(data),
      });

      // then
      const { grown, plans } = traced[0] as {
        grown: unknown[];
        plans: unknown[];
      };
      expect(grown).toHaveLength(2);
      expect(plans).toEqual([]);
    });
  });

  it.each<[string, AddRoadsOptions]>([
    ['roads.windiness', { windiness: 2 }],
    ['roads.width', { width: { min: 0, max: 1 } }],
    ['bridgeAngle', { bridgeAngle: { min: 1, max: 180 } }],
    ['roadTile', { roadTile: 99 as Tile }],
    ['bridgeTile', { bridgeTile: 99 as Tile }],
    ['addRoads.clearance', { clearance: -1 }],
    ['addRoads.falloff', { falloff: 1.5 }],
  ])('throws a RangeError at once for a bad %s', (name, options) => {
    // given
    const bad = options;

    // when
    const call = () => addRoads(bad);

    // then
    expect(call).toThrow(RangeError);
    expect(call).toThrow(name);
  });
});
