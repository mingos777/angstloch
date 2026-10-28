import { describe, expect, it } from 'vitest';
import { Tile } from '../core/tile';
import { emptyMap } from '../pipeline/empty-map';
import { pipeline } from '../pipeline/pipeline';
import { step } from '../pipeline/step';
import { addRoads } from '../streams/add-roads';
import type { AddRoadsOptions } from '../streams/add-roads-options';
import { addStreams } from '../streams/add-streams';
import type { AddStreamsOptions } from '../streams/add-streams-options';
import type { Road } from '../roads/road';
import { mulberry32 } from '../test-helpers/mulberry32';
import type { ClearingSpec } from './clearing-spec';
import { placeClearings } from './place-clearings';
import type { PlaceClearingsOptions } from './place-clearings-options';
import { plantTrees } from './plant-trees';

const base = emptyMap({ width: 80, height: 60, tile: Tile.Grass });
const solid = plantTrees({ density: { min: 1, max: 1 } });
const CIRCLE = { x: 40, y: 30, radiusX: { min: 6, max: 6 }, irregularity: 0 };
const LEVEL: AddStreamsOptions = { angle: 0, windiness: 0 };

/** Dense trees, then streams, roads and clearings as a forest lays them. */
function build(
  clearings: PlaceClearingsOptions,
  {
    roads,
    streams,
    seed = 1,
  }: {
    roads?: AddRoadsOptions;
    streams?: AddStreamsOptions;
    seed?: number;
  } = {},
) {
  const options = { random: mulberry32(seed) };
  const place = placeClearings(clearings);
  const result =
    roads && streams
      ? pipeline(
          base,
          [solid, addStreams(streams), addRoads(roads), place],
          options,
        )
      : roads
        ? pipeline(base, [solid, addRoads(roads), place], options)
        : streams
          ? pipeline(base, [solid, addStreams(streams), place], options)
          : pipeline(base, [solid, place], options);
  // what was not laid is empty
  const laid = result as { roads?: Road[]; streams?: Road[] };
  return { ...result, roads: laid.roads ?? [], streams: laid.streams ?? [] };
}

describe('placeClearings', () => {
  it('reports the clearings with their defaults filled in', () => {
    // given
    const clearings = [{ x: 10, y: 12, radiusX: { min: 4, max: 4 } }];

    // when
    const result = build({ clearings });

    // then
    expect(result.clearings).toEqual([
      { x: 10, y: 12, radiusX: 4, radiusY: 4, angle: 0 },
    ]);
  });

  it('reports no clearings for an empty list', () => {
    // given
    const options = { clearings: [] };

    // when
    const result = build(options);

    // then
    expect(result.clearings).toEqual([]);
  });

  it('does not change the forest for an empty list', () => {
    // given
    const plain = pipeline(base, [solid], { random: mulberry32(5) });

    // when
    const empty = build({ clearings: [] }, { seed: 5 });

    // then
    expect(empty.grid.toString()).toBe(plain.grid.toString());
  });

  it('keeps the trees out of the clearing', () => {
    // given
    const options = { clearings: [CIRCLE] };

    // when
    const { grid } = build(options);

    // then
    expect(grid.get(40, 30)).toBe(Tile.Grass);
    expect(grid.get(45, 30)).toBe(Tile.Grass);
    expect(grid.get(47, 30)).toBe(Tile.Tree);
  });

  it('clears the prunable bit of the trees it removes', () => {
    // given
    const options = { clearings: [CIRCLE] };

    // when
    const { grid, prunable } = build(options);

    // then
    expect(prunable[30 * 80 + 40]).toBe(0);
    expect(prunable[30 * 80 + 47]).toBe(1);
    expect(grid.get(47, 30)).toBe(Tile.Tree);
  });

  it('thins the trees beyond the edge with a falloff', () => {
    // given
    const options = { clearings: [CIRCLE], falloff: 3 };
    const seeds = Array.from({ length: 300 }, (_, seed) => seed + 1);

    // when
    const xs = [46, 47, 48, 50];
    const counts = [0, 0, 0, 0];
    for (const seed of seeds) {
      const { grid } = build(options, { seed });
      xs.forEach((x, at) => {
        counts[at] =
          (counts[at] ?? 0) + (grid.get(x, 30) === Tile.Tree ? 1 : 0);
      });
    }
    const shares = counts.map((count) => count / seeds.length);

    // then: 0, a quarter, a half, all
    expect(shares[0]).toBe(0);
    expect(shares[1]).toBeGreaterThan(0.17);
    expect(shares[1]).toBeLessThan(0.33);
    expect(shares[2]).toBeGreaterThan(0.43);
    expect(shares[2]).toBeLessThan(0.57);
    expect(shares[3]).toBe(1);
  });

  it('leaves a road through a clearing as a road', () => {
    // given
    const roads = { angle: 0, windiness: 0 };

    // when
    const { grid, roads: laid } = build({ clearings: [CIRCLE] }, { roads });

    // then
    const point = laid[0]?.points[40] as { x: number; y: number };
    expect(grid.get(point.x, point.y)).toBe(Tile.Road);
  });

  it('makes a different outline for every clearing', () => {
    // given
    const same = { radiusX: { min: 8, max: 8 }, irregularity: 1 };
    const clearings = [
      { x: 20, y: 30, ...same },
      { x: 60, y: 30, ...same },
    ];

    // when
    const { grid } = build({ clearings });

    // then
    const outline = (left: number) => {
      let rows = '';
      for (let y = 20; y < 41; ++y) {
        for (let x = left - 10; x < left + 11; ++x) {
          rows += grid.get(x, y) === Tile.Grass ? '.' : '#';
        }
      }
      return rows;
    };
    expect(outline(20)).not.toBe(outline(60));
  });

  it('places a clearing without a center at random', () => {
    // given
    const clearings = [{ radiusX: { min: 5, max: 5 }, irregularity: 0 }];

    // when
    const { grid, clearings: made } = build({ clearings });

    // then
    const [clearing] = made;
    expect(grid.get(clearing?.x ?? -1, clearing?.y ?? -1)).toBe(Tile.Grass);
  });

  it('keeps random clearings apart by the spacing', () => {
    // given
    const clearings = Array.from({ length: 3 }, () => ({
      radiusX: { min: 5, max: 5 },
    }));

    // when
    const result = build({ clearings, spacing: 12 });

    // then
    const [a, b] = result.clearings;
    expect(
      Math.hypot((a?.x ?? 0) - (b?.x ?? 0), (a?.y ?? 0) - (b?.y ?? 0)),
    ).toBeGreaterThanOrEqual(22);
  });

  it('places random clearings within the road distance of a road', () => {
    // given
    const roads = { angle: 0, windiness: 0 };
    const clearings = Array.from({ length: 3 }, () => ({
      radiusX: { min: 3, max: 3 },
      roadDistance: { min: 10, max: 14 },
    }));

    // when
    const { clearings: made, roads: laid } = build({ clearings }, { roads });

    // then
    const centerline = laid[0]?.points ?? [];
    expect(made).toHaveLength(3);
    for (const { x, y } of made) {
      const away = Math.min(
        ...centerline.map((p) =>
          Math.max(Math.abs(p.x - x), Math.abs(p.y - y)),
        ),
      );
      // the road is 3 tiles wide, so its edge is a tile nearer than its middle
      expect(away).toBeGreaterThanOrEqual(11);
      expect(away).toBeLessThanOrEqual(15);
    }
  });

  it('merges clearings that overlap into one bare patch', () => {
    // given
    const clearings = [
      { x: 30, y: 30, radiusX: { min: 6, max: 6 }, irregularity: 0 },
      { x: 38, y: 30, radiusX: { min: 6, max: 6 }, irregularity: 0 },
    ];

    // when
    const { grid } = build({ clearings });

    // then
    for (let x = 24; x <= 44; ++x) {
      expect(grid.get(x, 30)).toBe(Tile.Grass);
    }
    expect(grid.get(46, 30)).toBe(Tile.Tree);
  });

  it('is deterministic for the same seed', () => {
    // given
    const clearings = [
      { radiusX: { min: 2, max: 6 } },
      { radiusX: { min: 4, max: 4 } },
    ];

    // when
    const a = build({ clearings }, { seed: 9 });
    const b = build({ clearings }, { seed: 9 });

    // then
    expect(a.grid.toString()).toBe(b.grid.toString());
    expect(a.clearings).toEqual(b.clearings);
  });

  describe('clearings at branch ends', () => {
    const DEAD_ENDS: AddRoadsOptions = {
      specs: [
        { kind: 'road', origin: { x: 10, y: 30 }, angle: 0 },
        { parent: 0, at: 0.3, kind: 'branch', to: { x: 30, y: 10 } },
        { parent: 0, at: 0.6, kind: 'branch', to: { x: 60, y: 10 } },
        { parent: 0, at: 0.8, kind: 'branch', to: { x: 70, y: 50 } },
      ],
    };
    const AT_END: ClearingSpec = {
      at: 'branch-end',
      radiusX: { min: 3, max: 3 },
    };

    it('centers a clearing on the end of a branch', () => {
      // given
      const clearings = [AT_END];

      // when
      const { clearings: made, roads } = build(
        { clearings },
        { roads: DEAD_ENDS },
      );

      // then
      expect(made).toHaveLength(1);
      expect(made[0]).toMatchObject(roads[1]?.points.at(-1) ?? {});
    });

    it('takes the branch ends in the order the branches were laid', () => {
      // given
      const clearings = [AT_END, AT_END, AT_END];

      // when
      const { clearings: made, roads } = build(
        { clearings },
        { roads: DEAD_ENDS },
      );

      // then
      const ends = roads.slice(1).map((road) => road.points.at(-1));
      expect(made.map(({ x, y }) => ({ x, y }))).toEqual(ends);
    });

    it('leaves out the clearings that find no branch end', () => {
      // given
      const clearings = [AT_END, AT_END, AT_END, AT_END, AT_END];

      // when
      const { clearings: made } = build({ clearings }, { roads: DEAD_ENDS });

      // then
      expect(made).toHaveLength(3);
    });

    it('leaves out a clearing when there are no roads', () => {
      // given
      const clearings = [AT_END];

      // when
      const { clearings: made } = build({ clearings });

      // then
      expect(made).toEqual([]);
    });

    it('skips a branch that runs to the border of the map', () => {
      // given
      const roads: AddRoadsOptions = {
        specs: [
          { kind: 'road', origin: { x: 10, y: 30 }, angle: 0 },
          { parent: 0, at: 0.5, kind: 'branch', angle: 90 },
        ],
      };

      // when
      const { clearings: made } = build({ clearings: [AT_END] }, { roads });

      // then
      expect(made).toEqual([]);
    });

    it('lists them after the other clearings', () => {
      // given
      const clearings = [AT_END, { x: 5, y: 55, radiusX: { min: 2, max: 2 } }];

      // when
      const { clearings: made } = build({ clearings }, { roads: DEAD_ENDS });

      // then
      expect(made[0]).toMatchObject({ x: 5, y: 55 });
      expect(made).toHaveLength(2);
    });

    it('keeps clearings that overlap and merges them', () => {
      // given
      const roads: AddRoadsOptions = {
        specs: [
          { kind: 'road', origin: { x: 10, y: 30 }, angle: 0 },
          { parent: 0, at: 0.4, kind: 'branch', to: { x: 40, y: 10 } },
          { parent: 0, at: 0.6, kind: 'branch', to: { x: 41, y: 10 } },
        ],
      };

      // when
      const { clearings: made, grid } = build(
        { clearings: [AT_END, AT_END] },
        { roads },
      );

      // then
      expect(made).toHaveLength(2);
      expect(grid.get(40, 10)).toBe(Tile.Road);
      expect(grid.get(40, 8)).toBe(Tile.Grass);
    });
  });

  describe('paths', () => {
    it('carries the path that was asked for, with its defaults filled in', () => {
      // given
      const clearings = [{ ...CIRCLE, path: true }];

      // when
      const { clearings: made } = build({ clearings });

      // then
      expect(made[0]?.path).toEqual({ width: 1, windiness: 0.3 });
    });

    it('carries the width and windiness of the options of the path', () => {
      // given
      const clearings = [{ ...CIRCLE, path: { width: 2 } }];

      // when
      const { clearings: made } = build({ clearings });

      // then
      expect(made[0]?.path).toEqual({ width: 2, windiness: 0.3 });
    });

    it('carries no path unless asked', () => {
      // given
      const clearings = [CIRCLE, { ...CIRCLE, x: 10, path: false }];

      // when
      const { clearings: made } = build({ clearings });

      // then
      expect(made.map((clearing) => 'path' in clearing)).toEqual([
        false,
        false,
      ]);
    });

    it('lays no path itself', () => {
      // given
      const clearings = [{ ...CIRCLE, path: true }];

      // when
      const { grid } = build({ clearings });

      // then
      expect(
        Array.from({ length: 80 }, (_, x) => grid.get(x, 30)).includes(
          Tile.Road,
        ),
      ).toBe(false);
    });
  });

  describe('clearings on a stream', () => {
    const ON_STREAM: ClearingSpec = {
      at: 'stream',
      radiusX: { min: 5, max: 5 },
      irregularity: 0,
    };

    it('centers a clearing on a tile of the centerline of the stream', () => {
      // given
      const clearings = [ON_STREAM];

      // when
      const { clearings: made, streams } = build(
        { clearings },
        { streams: LEVEL },
      );

      // then
      expect(made).toHaveLength(1);
      expect(streams[0]?.points).toContainEqual({
        x: made[0]?.x,
        y: made[0]?.y,
      });
    });

    it('leaves the water in the clearing as water', () => {
      // given
      const clearings = [ON_STREAM];

      // when
      const { grid, clearings: made } = build(
        { clearings },
        { streams: LEVEL },
      );

      // then
      const [clearing] = made;
      expect(grid.get(clearing?.x ?? -1, clearing?.y ?? -1)).toBe(
        Tile.ShallowWater,
      );
    });

    it('keeps the trees out of the clearing on both banks', () => {
      // given
      const clearings = [ON_STREAM];
      const streams = { ...LEVEL, width: { min: 1, max: 1 } };

      // when
      const { grid, clearings: made } = build({ clearings }, { streams });

      // then
      const { x = 0, y = 0 } = made[0] ?? {};
      expect(grid.get(x, y - 3)).toBe(Tile.Grass);
      expect(grid.get(x, y + 3)).toBe(Tile.Grass);
      expect(grid.get(x, y + 8)).toBe(Tile.Tree);
    });

    it('is left out when there is no stream', () => {
      // given
      const clearings = [ON_STREAM];

      // when
      const { clearings: made } = build({ clearings });

      // then
      expect(made).toEqual([]);
    });

    it('keeps away from the other clearings by the spacing', () => {
      // given
      const clearings = [ON_STREAM, ON_STREAM];

      // when
      const { clearings: made } = build(
        { clearings, spacing: 3 },
        { streams: LEVEL },
      );

      // then
      expect(made).toHaveLength(2);
      const [a, b] = made;
      expect(
        Math.hypot((a?.x ?? 0) - (b?.x ?? 0), (a?.y ?? 0) - (b?.y ?? 0)),
      ).toBeGreaterThanOrEqual(13);
    });

    it('gets no path', () => {
      // given
      const clearings = [{ ...ON_STREAM, path: true }];

      // when
      const { clearings: made } = build({ clearings }, { streams: LEVEL });

      // then
      expect(made[0]).not.toHaveProperty('path');
    });

    it('is placed on a tributary as well as on the stream', () => {
      // given
      const clearings = Array.from({ length: 12 }, () => ({
        ...ON_STREAM,
        radiusX: { min: 1, max: 1 },
      }));
      const streams = { ...LEVEL, tributaries: { min: 1, max: 1 } };

      // when
      const { clearings: made, streams: laid } = build(
        { clearings },
        { streams },
      );

      // then
      const onTributary = made.some((clearing) =>
        laid[1]?.points.some(
          ({ x, y }) => x === clearing.x && y === clearing.y,
        ),
      );
      expect(onTributary).toBe(true);
    });
  });

  describe('options', () => {
    it.each<[string, PlaceClearingsOptions]>([
      ['spacing', { clearings: [], spacing: -1 }],
      ['spacing', { clearings: [], spacing: 1.5 }],
      ['placeClearings.falloff', { clearings: [], falloff: 1.5 }],
      [
        'clearings[0].radiusX',
        { clearings: [{ radiusX: { min: 0, max: 1 } }] },
      ],
      [
        'clearings[0].at',
        { clearings: [{ at: 'sea' as 'stream', radiusX: { min: 3, max: 3 } }] },
      ],
      [
        'clearings[0].at',
        {
          clearings: [
            { at: 'stream', x: 5, y: 5, radiusX: { min: 3, max: 3 } },
          ],
        },
      ],
    ])('throws a RangeError at once for a bad %s', (name, options) => {
      // given
      const bad = options;

      // when
      const call = () => placeClearings(bad);

      // then
      expect(call).toThrow(RangeError);
      expect(call).toThrow(name);
    });

    it('throws a RangeError before any step runs for a center outside the map', () => {
      // given
      let calls = 0;
      const counting = step('counting', {}, () => {
        ++calls;
        return {};
      });
      const place = placeClearings({
        clearings: [{ x: 200, y: 5, radiusX: { min: 3, max: 3 } }],
      });

      // when
      const call = () => pipeline(base, [counting, place]);

      // then
      expect(call).toThrow(RangeError);
      expect(calls).toBe(0);
    });

    it('measures the falloff with the distance', () => {
      // given
      const options = (distance: 'chebyshev' | 'euclidean') => ({
        clearings: [{ ...CIRCLE, x: 20, y: 20, radiusX: { min: 3, max: 3 } }],
        falloff: 2,
        distance,
      });
      const treesAround = (distance: 'chebyshev' | 'euclidean') => {
        let total = 0;
        for (let seed = 1; seed <= 30; ++seed) {
          const { grid } = build(options(distance), { seed });
          for (let y = 10; y < 30; ++y) {
            for (let x = 10; x < 30; ++x) {
              total += grid.get(x, y) === Tile.Tree ? 1 : 0;
            }
          }
        }
        return total;
      };

      // when
      const square = treesAround('chebyshev');
      const round = treesAround('euclidean');

      // then
      expect(round).toBeGreaterThan(square);
    });
  });
});
