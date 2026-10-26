import { describe, expect, it } from 'vitest';
import type { Grid } from '../core/grid';
import { Tile } from '../core/tile';
import { findSpans } from '../streams/find-spans';
import type { StreamOptions } from '../streams/stream-options';
import { mulberry32 } from '../test-helpers/mulberry32';
import type { ForestOptions } from './forest-options';
import { generateForest } from './generate-forest';

function forest(options: Partial<ForestOptions> = {}, seed = 1) {
  return generateForest({
    width: 80,
    height: 60,
    random: mulberry32(seed),
    ...options,
  });
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

/** Trees on every tile that is not cleared. */
const DENSE = { minDensity: 1, maxDensity: 1 };
/** A stream that runs left to right in a straight line. */
const LEVEL: StreamOptions = { angle: 0, windiness: 0 };
/** A road that runs top to bottom in a straight line. */
const UPRIGHT = { angle: 90, windiness: 0, width: { min: 3, max: 3 } };

describe('generateForest streams', () => {
  it('lays no water without the streams option', () => {
    // given
    const options = {};

    // when
    const { grid, streams, bridges } = forest(options);

    // then
    expect(count(grid, Tile.ShallowWater)).toBe(0);
    expect(count(grid, Tile.DeepWater)).toBe(0);
    expect(streams).toEqual([]);
    expect(bridges).toEqual([]);
  });

  it('lays shallow water along the banks and deep water in the middle', () => {
    // given
    const options = { streams: { ...LEVEL, width: { min: 3, max: 3 } } };

    // when
    const { grid } = forest(options);

    // then: three rows of water across the map, the middle one deep, less a footbridge
    expect(count(grid, Tile.DeepWater)).toBe(79);
    expect(count(grid, Tile.ShallowWater)).toBe(158);
  });

  it('leaves a stream of width 2 all shallow', () => {
    // given
    const options = { streams: { ...LEVEL, width: { min: 2, max: 2 } } };

    // when
    const { grid } = forest(options);

    // then
    expect(count(grid, Tile.DeepWater)).toBe(0);
    expect(count(grid, Tile.ShallowWater)).toBe(158);
  });

  it('widens the shallow banks with the shore width', () => {
    // given
    const options = {
      streams: { ...LEVEL, width: { min: 5, max: 5 }, shoreWidth: 2 },
    };

    // when
    const { grid } = forest(options);

    // then
    expect(count(grid, Tile.DeepWater)).toBe(79);
    expect(count(grid, Tile.ShallowWater)).toBe(316);
  });

  it('reports the streams with their centerlines and widths', () => {
    // given
    const options = { streams: { ...LEVEL, width: { min: 2, max: 2 } } };

    // when
    const { streams } = forest(options);

    // then
    expect(streams).toHaveLength(1);
    expect(streams[0]?.width).toBe(2);
    expect(streams[0]?.points[0]?.x).toBe(0);
    expect(streams[0]?.points.at(-1)?.x).toBe(79);
  });

  it('grows no tree in the water', () => {
    // given
    const options = {
      minDensity: 1,
      maxDensity: 1,
      streams: { ...LEVEL, width: { min: 3, max: 3 } },
    };

    // when
    const { grid } = forest(options);

    // then: the water takes its three rows, the trees the rest
    expect(count(grid, Tile.Tree)).toBe(80 * 60 - 240);
  });

  it('lays a bridge where a road crosses the stream', () => {
    // given
    const options = { streams: LEVEL, roads: UPRIGHT };

    // when
    const { grid, bridges } = forest(options);

    // then
    expect(bridges).toHaveLength(1);
    const [bridge] = bridges;
    expect(grid.get(bridge?.x ?? -1, bridge?.y ?? -1)).toBe(Tile.Bridge);
  });

  it('makes the bridge as wide as the road and the stream', () => {
    // given
    const options = {
      streams: {
        ...LEVEL,
        width: { min: 2, max: 2 },
        bridgeAngle: { min: 90, max: 90 },
      },
      roads: UPRIGHT,
    };

    // when
    const { grid } = forest(options);

    // then
    expect(count(grid, Tile.Bridge)).toBe(6);
  });

  it('keeps the road tiles beyond the water', () => {
    // given
    const options = { streams: LEVEL, roads: UPRIGHT };

    // when
    const { grid } = forest(options);

    // then
    expect(count(grid, Tile.Road)).toBeGreaterThan(0);
  });

  it('bends a road to cross the stream at the bridge angle', () => {
    // given
    const options = {
      streams: { ...LEVEL, bridgeAngle: { min: 90, max: 90 } },
      roads: { angle: 70, windiness: 0 },
    };

    // when
    const { bridges, roads } = forest(options);

    // then: near the bridge the road runs straight down a column
    const [bridge] = bridges;
    const near = (roads[0]?.points ?? []).filter(
      ({ y }) => Math.abs(y - (bridge?.y ?? 0)) <= 2,
    );
    expect(new Set(near.map(({ x }) => x)).size).toBe(1);
  });

  it('does not bend the roads of exact specs, which are bridged where they cross', () => {
    // given
    const options = {
      streams: { ...LEVEL, bridgeAngle: { min: 90, max: 90 } },
      roads: {
        specs: [{ origin: { x: 40, y: 30 }, angle: 45, windiness: 0 }],
      },
    };

    // when
    const { bridges, roads } = forest(options);

    // then
    expect(bridges).toHaveLength(1);
    const [bridge] = bridges;
    const near = (roads[0]?.points ?? []).filter(
      ({ y }) => Math.abs(y - (bridge?.y ?? 0)) <= 2,
    );
    expect(new Set(near.map(({ x }) => x)).size).toBeGreaterThan(1);
  });

  it('finds one bridge for every road that crosses the stream', () => {
    // given
    const options = {
      streams: LEVEL,
      roads: {
        ...UPRIGHT,
        crossings: { min: 1, max: 1 },
        width: { min: 1, max: 1 },
      },
    };

    // when
    const { bridges } = forest(options, 4);

    // then
    expect(bridges.length).toBeGreaterThanOrEqual(1);
  });

  it('uses the tiles it is given for the water and the bridge', () => {
    // given
    const options = {
      streams: { ...LEVEL, width: { min: 3, max: 3 } },
      roads: UPRIGHT,
      shallowTile: Tile.Floor,
      deepTile: Tile.Wall,
      bridgeTile: Tile.Door,
    };

    // when
    const { grid } = forest(options);

    // then
    expect(count(grid, Tile.ShallowWater)).toBe(0);
    expect(count(grid, Tile.DeepWater)).toBe(0);
    expect(count(grid, Tile.Bridge)).toBe(0);
    expect(count(grid, Tile.Door)).toBeGreaterThan(0);
  });

  it('lays a footbridge across a stream that no road crosses', () => {
    // given
    const options = { streams: LEVEL };

    // when
    const { grid, bridges } = forest(options);

    // then
    expect(bridges).toHaveLength(1);
    const [bridge] = bridges;
    expect(grid.get(bridge?.x ?? -1, bridge?.y ?? -1)).toBe(Tile.Bridge);
  });

  it('makes a footbridge one tile wide, however wide the road would be', () => {
    // given
    const options = { streams: { ...LEVEL, width: { min: 3, max: 3 } } };

    // when
    const { grid } = forest(options);

    // then
    expect(count(grid, Tile.Bridge)).toBe(3);
  });

  it('lays no footbridge when a road crosses the stream', () => {
    // given
    const options = { streams: LEVEL, roads: UPRIGHT };

    // when
    const { bridges } = forest(options);

    // then
    expect(bridges).toHaveLength(1);
  });

  it('lays no footbridge across a stream that has a spring', () => {
    // given
    const options = { streams: { ...LEVEL, spring: true } };

    // when
    const { grid, bridges } = forest(options);

    // then
    expect(bridges).toEqual([]);
    expect(count(grid, Tile.Bridge)).toBe(0);
  });

  it('lays footbridges up to the bridges asked for', () => {
    // given
    const options = { streams: { ...LEVEL, bridges: 3 } };

    // when
    const { bridges } = forest(options);

    // then
    expect(bridges).toHaveLength(3);
  });

  it('starts a stream with a spring inside the map', () => {
    // given
    const options = { streams: { ...LEVEL, spring: true } };

    // when
    const { streams } = forest(options);

    // then
    const [spring] = streams[0]?.points ?? [];
    expect(spring?.x).toBeGreaterThan(0);
  });

  it('reports a tributary after the main stream, flowing into it', () => {
    // given
    const options = { streams: { ...LEVEL, tributaries: { min: 1, max: 1 } } };

    // when
    const { streams } = forest(options);

    // then
    expect(streams.map(({ kind }) => kind)).toEqual(['road', 'branch']);
    expect(streams[0]?.points).toContainEqual(streams[1]?.points.at(-1));
  });

  it('lays shallow water along a tributary', () => {
    // given
    const options = { streams: { ...LEVEL, tributaries: { min: 1, max: 1 } } };

    // when
    const { grid, streams } = forest(options);

    // then
    const source = streams[1]?.points[0];
    expect(grid.get(source?.x ?? -1, source?.y ?? -1)).toBe(Tile.ShallowWater);
  });

  it('lets trees grow right up to the water by default', () => {
    // given
    const options = {
      ...DENSE,
      streams: { ...LEVEL, width: { min: 1, max: 1 } },
    };

    // when
    const { grid, streams } = forest(options);

    // then
    const row = streams[0]?.points[0]?.y ?? 0;
    expect(grid.get(40, row - 1)).toBe(Tile.Tree);
    expect(grid.get(40, row + 1)).toBe(Tile.Tree);
  });

  it('keeps trees off the tiles beside the water for the bank clearance', () => {
    // given
    const options = {
      ...DENSE,
      streams: { ...LEVEL, width: { min: 1, max: 1 } },
      bankClearance: 2,
    };

    // when
    const { grid, streams } = forest(options);

    // then
    const row = streams[0]?.points[0]?.y ?? 0;
    expect(grid.get(40, row - 2)).toBe(Tile.Grass);
    expect(grid.get(40, row + 2)).toBe(Tile.Grass);
    expect(grid.get(40, row + 3)).toBe(Tile.Tree);
  });

  it('thickens the trees in steps beyond the bank clearance with the bank falloff', () => {
    // given
    const options = {
      ...DENSE,
      streams: { ...LEVEL, width: { min: 1, max: 1 } },
      bankFalloff: 3,
    };

    // when
    const { density, streams } = forest(options);

    // then
    const row = streams[0]?.points[0]?.y ?? 0;
    const chance = (steps: number) => density[(row + steps) * 80 + 40];
    expect([1, 2, 3, 4].map(chance)).toEqual([0.25, 0.5, 0.75, 1]);
  });

  it('keeps the verge of a road apart from the verge of the bank', () => {
    // given
    const options = {
      ...DENSE,
      streams: { ...LEVEL, width: { min: 1, max: 1 } },
      roads: UPRIGHT,
      clearance: 3,
    };

    // when
    const { grid, streams } = forest(options);

    // then: the road keeps its trees back, the water does not
    const row = streams[0]?.points[0]?.y ?? 0;
    expect(grid.get(2, row - 1)).toBe(Tile.Tree);
  });

  it('is deterministic for the same seed', () => {
    // given
    const options = {
      streams: { width: { min: 1, max: 4 } },
      roads: { crossings: { min: 1, max: 2 } },
    };

    // when
    const a = forest(options, 5);
    const b = forest(options, 5);

    // then
    expect(a.grid.toString()).toBe(b.grid.toString());
    expect(a.bridges).toEqual(b.bridges);
  });

  it('keeps the roads where they are without streams', () => {
    // given
    const roads = { crossings: { min: 1, max: 2 } };

    // when
    const plain = forest({ roads }, 6);
    const again = forest({ roads, streams: undefined }, 6);

    // then
    expect(again.grid.toString()).toBe(plain.grid.toString());
  });

  it.each<[string, Partial<ForestOptions>]>([
    ['streams.windiness', { streams: { windiness: 2 } }],
    ['streams.shoreWidth', { streams: { shoreWidth: -1 } }],
    ['streams.width', { streams: { width: { min: 0, max: 1 } } }],
    ['streams.bridgeAngle', { streams: { bridgeAngle: { min: 1, max: 180 } } }],
    ['bankClearance', { bankClearance: -1 }],
    ['bankFalloff', { bankFalloff: 1.5 }],
    ['shallowTile', { shallowTile: 99 as Tile }],
    ['deepTile', { deepTile: 99 as Tile }],
    ['bridgeTile', { bridgeTile: 99 as Tile }],
  ])('throws for an invalid %s', (name, options) => {
    // given
    const generate = () => forest(options);

    // when / then
    expect(generate).toThrow(RangeError);
    expect(generate).toThrow(name);
  });

  it('lays a bridge only where a road spans the water', () => {
    // given
    const seeds = Array.from({ length: 30 }, (_, seed) => seed + 1);

    // when
    const clipped = seeds.filter((seed) => {
      const { grid } = forest(
        {
          streams: { angle: 'random', width: { min: 3, max: 3 } },
          roads: { angle: 'random', width: { min: 3, max: 3 } },
        },
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

  it('bridges a road that must cross the stream near the edge of the map', () => {
    // given
    const options = {
      width: 80,
      height: 50,
      streams: { angle: 'random' as const, width: { min: 3, max: 3 } },
      roads: { angle: 'random' as const },
    };

    // when
    const { grid, bridges, roads } = generateForest({
      ...options,
      random: mulberry32(27),
    });

    // then: the road reaches its end on the left edge across a bridge
    const end = roads[0]?.points.at(-1);
    expect(bridges.length).toBeGreaterThan(0);
    expect(grid.get(end?.x ?? 0, end?.y ?? 0)).toBe(Tile.Road);
  });

  describe('clearings on a stream', () => {
    const ON_STREAM = {
      at: 'stream' as const,
      radiusX: { min: 5, max: 5 },
      irregularity: 0,
    };

    it('centers a clearing on a tile of the centerline of the stream', () => {
      // given
      const options = { streams: LEVEL, clearings: [ON_STREAM] };

      // when
      const { clearings, streams } = forest(options);

      // then
      expect(clearings).toHaveLength(1);
      expect(streams[0]?.points).toContainEqual({
        x: clearings[0]?.x,
        y: clearings[0]?.y,
      });
    });

    it('leaves the water in the clearing as water', () => {
      // given
      const options = { streams: LEVEL, clearings: [ON_STREAM] };

      // when
      const { grid, clearings } = forest(options);

      // then
      const [clearing] = clearings;
      expect(grid.get(clearing?.x ?? -1, clearing?.y ?? -1)).toBe(
        Tile.ShallowWater,
      );
    });

    it('keeps the trees out of the clearing on both banks', () => {
      // given
      const options = {
        ...DENSE,
        streams: { ...LEVEL, width: { min: 1, max: 1 } },
        clearings: [ON_STREAM],
      };

      // when
      const { grid, clearings } = forest(options);

      // then
      const { x = 0, y = 0 } = clearings[0] ?? {};
      expect(grid.get(x, y - 3)).toBe(Tile.Grass);
      expect(grid.get(x, y + 3)).toBe(Tile.Grass);
      expect(grid.get(x, y + 8)).toBe(Tile.Tree);
    });

    it('is left out when there is no stream', () => {
      // given
      const options = { clearings: [ON_STREAM] };

      // when
      const { clearings } = forest(options);

      // then
      expect(clearings).toEqual([]);
    });

    it('keeps away from the other clearings by the spacing', () => {
      // given
      const options = {
        streams: LEVEL,
        clearings: [ON_STREAM, ON_STREAM],
        clearingSpacing: 3,
      };

      // when
      const { clearings } = forest(options);

      // then
      expect(clearings).toHaveLength(2);
      const [a, b] = clearings;
      expect(
        Math.hypot((a?.x ?? 0) - (b?.x ?? 0), (a?.y ?? 0) - (b?.y ?? 0)),
      ).toBeGreaterThanOrEqual(13);
    });

    it('gets no path', () => {
      // given
      const options = {
        streams: LEVEL,
        clearings: [{ ...ON_STREAM, path: true }],
      };

      // when
      const { roads } = forest(options);

      // then
      expect(roads).toEqual([]);
    });

    it('is placed on a tributary as well as on the stream', () => {
      // given
      const options = {
        streams: { ...LEVEL, tributaries: { min: 1, max: 1 } },
        clearings: Array.from({ length: 12 }, () => ({
          ...ON_STREAM,
          radiusX: { min: 1, max: 1 },
        })),
      };

      // when
      const { clearings, streams } = forest(options);

      // then
      const onTributary = clearings.some((clearing) =>
        streams[1]?.points.some(
          ({ x, y }) => x === clearing.x && y === clearing.y,
        ),
      );
      expect(onTributary).toBe(true);
    });

    it('rejects an unknown place', () => {
      // given
      const options = {
        clearings: [{ ...ON_STREAM, at: 'sea' as 'stream' }],
      };

      // when / then
      expect(() => forest(options)).toThrow(
        "at must be 'branch-end' or 'stream'",
      );
    });

    it('rejects a place together with a center', () => {
      // given
      const options = { clearings: [{ ...ON_STREAM, x: 5, y: 5 }] };

      // when / then
      expect(() => forest(options)).toThrow(RangeError);
    });
  });
});
