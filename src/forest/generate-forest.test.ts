import { describe, expect, it } from 'vitest';
import type { Grid } from '../core/grid';
import { Tile } from '../core/tile';
import { emptyMap } from '../pipeline/empty-map';
import { pipeline } from '../pipeline/pipeline';
import { TemplateCell } from '../rooms/templates/template-cell';
import { TemplatePlacementError } from '../rooms/templates/template-placement-error';
import { mulberry32 } from '../test-helpers/mulberry32';
import { createForestSteps } from './create-forest-steps';
import type { ForestOptions } from './forest-options';
import { generateForest } from './generate-forest';

const { Unused: U, Floor: F, Wall: W } = TemplateCell;

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
const SOLID = { trees: { density: { min: 1, max: 1 } } };
/** A stream that runs left to right in a straight line. */
const LEVEL = { angle: 0, windiness: 0, width: { min: 3, max: 3 } };
/** A road that runs top to bottom in a straight line. */
const UPRIGHT = { angle: 90, windiness: 0, width: { min: 3, max: 3 } };
const RUIN = {
  name: 'ruin',
  cells: [
    [U, W, W, W, U],
    [W, F, F, F, W],
    [W, F, F, F, W],
    [W, F, F, F, W],
    [U, W, W, W, U],
  ],
  clearing: true,
};

describe('generateForest', () => {
  it('makes a map of the size that was asked for', () => {
    // given
    const options = { width: 30, height: 20 };

    // when
    const { grid } = forest(options);

    // then
    expect(grid.width).toBe(30);
    expect(grid.height).toBe(20);
  });

  it('plants trees on grass and nothing else by default', () => {
    // given
    const options = SOLID;

    // when
    const { grid, roads, streams, clearings, templates, bridges } =
      forest(options);

    // then
    expect(count(grid, Tile.Tree)).toBe(80 * 60);
    expect([roads, streams, clearings, templates, bridges]).toEqual([
      [],
      [],
      [],
      [],
      [],
    ]);
  });

  it('leaves grass between the trees by default', () => {
    // given
    const options = {};

    // when
    const { grid } = forest(options);

    // then
    expect(count(grid, Tile.Grass)).toBeGreaterThan(80 * 60 * 0.7);
    expect(count(grid, Tile.Tree)).toBeGreaterThan(0);
  });

  it('plants the tile of the trees option', () => {
    // given
    const options = { trees: { density: { min: 1, max: 1 }, tile: Tile.Wall } };

    // when
    const { grid } = forest(options);

    // then
    expect(count(grid, Tile.Wall)).toBe(80 * 60);
  });

  it('reports one attempt and no failures for an easy forest', () => {
    // given
    const options = {};

    // when
    const { attempts, failures } = forest(options);

    // then
    expect(attempts).toBe(1);
    expect(failures).toEqual([]);
  });

  it('keeps the trees off the roads and their verge', () => {
    // given
    const options = { ...SOLID, roads: { ...UPRIGHT, clearance: 2 } };

    // when
    const { grid, roads, exits } = forest(options);

    // then
    expect(roads).toHaveLength(1);
    expect(exits).toHaveLength(2);
    const x = roads[0]?.points[30]?.x ?? 0;
    expect(grid.get(x, 30)).toBe(Tile.Road);
    expect(grid.get(x + 3, 30)).toBe(Tile.Grass);
    expect(grid.get(x + 6, 30)).toBe(Tile.Tree);
  });

  it('lays a stream and joins the land it cuts with a footbridge', () => {
    // given
    const options = { streams: LEVEL };

    // when
    const { grid, streams, bridges } = forest(options);

    // then
    expect(streams).toHaveLength(1);
    expect(count(grid, Tile.ShallowWater)).toBeGreaterThan(0);
    expect(bridges).toHaveLength(1);
    expect(count(grid, Tile.Bridge)).toBe(3);
  });

  it('lays no footbridge when they are turned off', () => {
    // given
    const options = { streams: LEVEL, footbridges: false as const };

    // when
    const { grid, bridges } = forest(options);

    // then
    expect(bridges).toEqual([]);
    expect(count(grid, Tile.Bridge)).toBe(0);
  });

  it('lays footbridges up to the minimum', () => {
    // given
    const options = { streams: LEVEL, footbridges: { minimum: 3 } };

    // when
    const { bridges } = forest(options);

    // then
    expect(bridges).toHaveLength(3);
  });

  it('bridges a road that crosses a stream', () => {
    // given
    const options = { streams: LEVEL, roads: UPRIGHT };

    // when
    const { grid, bridges } = forest(options);

    // then
    expect(bridges).toHaveLength(1);
    const [bridge] = bridges;
    expect(grid.get(bridge?.x ?? -1, bridge?.y ?? -1)).toBe(Tile.Bridge);
  });

  it('makes the clearings that were asked for', () => {
    // given
    const clearings = [
      { x: 40, y: 30, radiusX: { min: 6, max: 6 }, irregularity: 0 },
    ];
    const options = { ...SOLID, clearings: { clearings } };

    // when
    const { grid, clearings: made } = forest(options);

    // then
    expect(made).toEqual([{ x: 40, y: 30, radiusX: 6, radiusY: 6, angle: 0 }]);
    expect(grid.get(40, 30)).toBe(Tile.Grass);
    expect(grid.get(60, 30)).toBe(Tile.Tree);
  });

  it('lays the paths that clearings ask for, with the tiles of the roads', () => {
    // given
    const clearings = [
      {
        x: 40,
        y: 10,
        radiusX: { min: 3, max: 3 },
        path: { width: 1, windiness: 0 },
      },
    ];
    const roads = { angle: 0, windiness: 0, roadTile: Tile.Floor };
    const options = { roads, clearings: { clearings } };

    // when
    const { roads: laid, junctions, grid } = forest(options);

    // then
    expect(laid).toHaveLength(2);
    expect(laid[1]?.kind).toBe('branch');
    expect(junctions).toHaveLength(1);
    expect(grid.get(40, 10)).toBe(Tile.Floor);
  });

  it('places a template on its clearing', () => {
    // given
    const clearings = [
      { x: 40, y: 30, radiusX: { min: 6, max: 6 }, irregularity: 0 },
    ];
    const options = {
      ...SOLID,
      clearings: { clearings },
      templates: { templates: [RUIN] },
    };

    // when
    const { grid, templates } = forest(options);

    // then
    expect(templates).toEqual([
      {
        template: 0,
        x: 38,
        y: 28,
        width: 5,
        height: 5,
        rotation: 0,
        mirrored: false,
        clearing: 0,
        ownClearing: false,
      },
    ]);
    expect(grid.get(40, 30)).toBe(Tile.Floor);
    expect(grid.get(38, 30)).toBe(Tile.Wall);
  });

  it('is made of the steps that createForestSteps lists', () => {
    // given
    const options = {
      streams: LEVEL,
      roads: UPRIGHT,
      clearings: { clearings: [{ radiusX: { min: 4, max: 4 }, path: true }] },
      templates: { templates: [RUIN] },
    };

    // when
    const names = createForestSteps(options).map(({ stepName }) => stepName);

    // then
    expect(names).toEqual([
      'plantTrees',
      'addStreams',
      'addRoads',
      'placeClearings',
      'placeTemplates',
      'addClearingPaths',
      'addFootbridges',
    ]);
  });

  it('leaves out the steps whose options are missing', () => {
    // given
    const options = {};

    // when
    const names = createForestSteps(options).map(({ stepName }) => stepName);

    // then
    expect(names).toEqual(['plantTrees']);
  });

  it('gives the same map as the steps run by hand', () => {
    // given
    const options = { streams: LEVEL, roads: UPRIGHT, ...SOLID };
    const steps = createForestSteps(options);

    // when
    const preset = forest(options, 7);
    const manual = pipeline(
      emptyMap({ width: 80, height: 60, tile: Tile.Grass }),
      steps,
      { random: mulberry32(7) },
    );

    // then
    expect(preset.grid.toString()).toBe(manual.grid.toString());
  });

  it('is deterministic for the same seed', () => {
    // given
    const options = {
      streams: LEVEL,
      roads: { angle: 'random' as const },
      clearings: { clearings: [{ radiusX: { min: 4, max: 4 }, path: true }] },
    };

    // when
    const a = forest(options, 5);
    const b = forest(options, 5);

    // then
    expect(a.grid.toString()).toBe(b.grid.toString());
    expect(a.roads).toEqual(b.roads);
    expect(a.clearings).toEqual(b.clearings);
  });

  it('does not change the options it is given', () => {
    // given
    const options = {
      width: 80,
      height: 60,
      random: mulberry32(1),
      streams: { ...LEVEL },
      roads: { ...UPRIGHT },
    };
    const before = JSON.stringify(options);

    // when
    generateForest(options);

    // then
    expect(JSON.stringify(options)).toBe(before);
  });

  it('throws a RangeError for dimensions that are not positive whole numbers', () => {
    // given
    const small = () => forest({ width: 0 });
    const half = () => forest({ height: 2.5 });

    // then
    expect(small).toThrow(RangeError);
    expect(half).toThrow(RangeError);
  });

  it('throws a RangeError for a bad option of a step', () => {
    // given
    const badDensity = () => forest({ trees: { density: { min: 0, max: 2 } } });
    const badRoads = () => forest({ roads: { roadTile: 99 as Tile } });
    const badTemplate = () =>
      forest({
        templates: { templates: [{ cells: [[W, TemplateCell.Exit]] }] },
      });

    // then
    expect(badDensity).toThrow(RangeError);
    expect(badRoads).toThrow(RangeError);
    expect(badTemplate).toThrow(RangeError);
  });

  it('throws a TemplatePlacementError at once for a template bigger than the map', () => {
    // given
    const huge = { cells: [Array.from({ length: 90 }, () => F)] };

    // when
    const run = () => forest({ templates: { templates: [huge] } });

    // then
    expect(run).toThrow(TemplatePlacementError);
  });

  it('throws a TemplatePlacementError after three attempts for a template with no room', () => {
    // given
    const wide = {
      cells: [Array.from({ length: 80 }, () => F)],
      clearing: false,
    };
    const roads = {
      windiness: 0,
      specs: [{ origin: { x: 40, y: 30 }, angle: 90 }],
    };
    const options = { roads, templates: { templates: [wide] } };

    // when
    const run = () => forest(options);

    // then
    expect(run).toThrow(TemplatePlacementError);
  });
});
