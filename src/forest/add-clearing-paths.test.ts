import { describe, expect, it } from 'vitest';
import { Tile } from '../core/tile';
import { emptyMap } from '../pipeline/empty-map';
import { pipeline } from '../pipeline/pipeline';
import { stampTile } from '../pipeline/stamp-tile';
import { step } from '../pipeline/step';
import type { Road } from '../roads/road';
import type { RoomTemplate } from '../rooms/templates/room-template';
import { TemplateCell } from '../rooms/templates/template-cell';
import { addRoads } from '../streams/add-roads';
import { mulberry32 } from '../test-helpers/mulberry32';
import { addClearingPaths } from './add-clearing-paths';
import type { AddClearingPathsOptions } from './add-clearing-paths-options';
import type { ClearingSpec } from './clearing-spec';
import { placeClearings } from './place-clearings';
import { placeTemplates } from './place-templates';
import { plantTrees } from './plant-trees';

const { Unused: U, Floor: F, Wall: W } = TemplateCell;

const base = emptyMap({ width: 80, height: 60, tile: Tile.Grass });
const solid = plantTrees({ density: { min: 1, max: 1 } });
const STRAIGHT = addRoads({ angle: 0, windiness: 0 });
const PATH = { width: 1, windiness: 0 };
const GLADE: ClearingSpec = {
  x: 40,
  y: 10,
  radiusX: { min: 3, max: 3 },
  path: PATH,
};

/** A 5 by 5 ruin: a ring of wall round a room, with unused corners. */
const RUIN: RoomTemplate = {
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

/** Dense trees, optionally a road along the middle, clearings, and the paths to them. */
function build(
  clearings: ClearingSpec[],
  {
    roads = true,
    options,
    seed = 1,
  }: { roads?: boolean; options?: AddClearingPathsOptions; seed?: number } = {},
) {
  const random = { random: mulberry32(seed) };
  const place = placeClearings({ clearings });
  const paths = addClearingPaths(options);
  return roads
    ? pipeline(base, [solid, STRAIGHT, place, paths], random)
    : pipeline(base, [solid, place, paths], random);
}

describe('addClearingPaths', () => {
  it('leads a path from a road to the center of a clearing', () => {
    // given
    const clearings = [GLADE];

    // when
    const { roads, grid } = build(clearings);

    // then
    const path = roads[1];
    expect(path?.kind).toBe('branch');
    expect(path?.points[path.points.length - 1]).toEqual({ x: 40, y: 10 });
    const start = path?.points[0];
    expect(roads[0]?.points).toContainEqual(start);
    expect(grid.get(start?.x ?? -1, start?.y ?? -1)).toBe(Tile.Road);
  });

  it('paints the path over the trees', () => {
    // given
    const clearings = [GLADE];

    // when
    const { grid, prunable, roads } = build(clearings);

    // then
    const [tile] = roads[1]?.points ?? [];
    expect(grid.get(tile?.x ?? -1, tile?.y ?? -1)).toBe(Tile.Road);
    expect(prunable[(tile?.y ?? 0) * 80 + (tile?.x ?? 0)]).toBe(0);
    expect(grid.get(40, 10)).toBe(Tile.Road);
  });

  it('joins the path to the road at a junction', () => {
    // given
    const clearings = [GLADE];

    // when
    const { junctions } = build(clearings);

    // then
    expect(junctions).toHaveLength(1);
  });

  it('makes no path unless asked', () => {
    // given
    const clearings = [{ x: 40, y: 10, radiusX: { min: 3, max: 3 } }];

    // when
    const { roads } = build(clearings);

    // then
    expect(roads).toHaveLength(1);
  });

  it('leaves the roads as they were when no path is asked for', () => {
    // given
    const clearings = [{ x: 40, y: 10, radiusX: { min: 3, max: 3 } }];
    const plain = pipeline(
      base,
      [solid, STRAIGHT, placeClearings({ clearings })],
      {
        random: mulberry32(6),
      },
    );

    // when
    const result = build(clearings, { seed: 6 });

    // then
    expect(result.roads).toEqual(plain.roads);
    expect(result.junctions).toEqual(plain.junctions);
    expect(result.exits).toEqual(plain.exits);
    expect(result.grid.toString()).toBe(plain.grid.toString());
  });

  it('leads a path from the border when there are no roads', () => {
    // given
    const clearings = [
      { x: 70, y: 30, radiusX: { min: 3, max: 3 }, path: PATH },
    ];

    // when
    const { roads, exits, grid } = build(clearings, { roads: false });

    // then
    expect(roads).toHaveLength(1);
    expect(roads[0]?.points[0]).toEqual({ x: 79, y: 30 });
    expect(exits).toEqual([{ x: 79, y: 30 }]);
    expect(grid.get(75, 30)).toBe(Tile.Road);
  });

  it('draws the path with the width that was asked for', () => {
    // given
    const path = { width: 3, windiness: 0 };
    const clearings = [{ x: 70, y: 30, radiusX: { min: 3, max: 3 }, path }];

    // when
    const { grid } = build(clearings, { roads: false });

    // then
    expect(grid.get(75, 29)).toBe(Tile.Road);
    expect(grid.get(75, 31)).toBe(Tile.Road);
  });

  it('uses the road and bridge tiles it is given', () => {
    // given
    const clearings = [
      { x: 70, y: 30, radiusX: { min: 3, max: 3 }, path: PATH },
    ];
    const options = { roadTile: Tile.Floor };

    // when
    const { grid } = build(clearings, { roads: false, options });

    // then
    expect(grid.get(75, 30)).toBe(Tile.Floor);
  });

  it('leads a path to a clearing placed at random', () => {
    // given
    const clearings = [{ radiusX: { min: 4, max: 4 }, path: PATH }];

    // when
    const { roads, clearings: made } = build(clearings);

    // then
    expect(roads).toHaveLength(2);
    expect(roads[1]?.points[roads[1].points.length - 1]).toEqual({
      x: made[0]?.x,
      y: made[0]?.y,
    });
  });

  it('leads a path to every clearing that asks for one', () => {
    // given
    const clearings = [
      { x: 15, y: 10, radiusX: { min: 3, max: 3 }, path: PATH },
      { radiusX: { min: 3, max: 3 }, path: PATH },
      { x: 60, y: 50, radiusX: { min: 3, max: 3 } },
      { x: 65, y: 12, radiusX: { min: 3, max: 3 }, path: { width: 2 } },
    ];

    // when
    const { roads, clearings: made } = build(clearings);

    // then
    const ends = roads.slice(1).map((road) => road.points.at(-1));
    expect(made).toHaveLength(4);
    expect(ends).toHaveLength(3);
    expect(ends).toContainEqual({ x: 15, y: 10 });
    expect(ends).toContainEqual({ x: 65, y: 12 });
    expect(ends).toContainEqual({ x: made[1]?.x, y: made[1]?.y });
  });

  it('clears the trees of its verge', () => {
    // given
    const clearings = [
      { x: 70, y: 30, radiusX: { min: 3, max: 3 }, path: PATH },
    ];
    const options = { clearance: 1 };

    // when
    const { grid } = build(clearings, { roads: false, options });

    // then
    expect(grid.get(75, 29)).toBe(Tile.Grass);
    expect(grid.get(75, 27)).toBe(Tile.Tree);
  });

  it('stops the path to a clearing at the edge of its template', () => {
    // given
    const clearings = [
      { x: 40, y: 40, radiusX: { min: 4, max: 4 }, path: PATH },
    ];
    const road = addRoads({
      windiness: 0,
      width: { min: 3, max: 3 },
      specs: [{ origin: { x: 40, y: 10 }, angle: 0 }],
    });
    const steps = [
      solid,
      road,
      placeClearings({ clearings }),
      placeTemplates({ templates: [RUIN] }),
      addClearingPaths(),
    ] as const;

    // when
    const { grid } = pipeline(base, steps, { random: mulberry32(1) });

    // then
    expect(grid.get(40, 37)).toBe(Tile.Road);
    expect(grid.get(40, 38)).toBe(Tile.Wall);
  });

  it('throws a TemplatePlacementError for a path that runs through a template', () => {
    // given
    const fence: RoomTemplate = {
      cells: Array.from({ length: 6 }, () =>
        Array.from({ length: 80 }, () => W),
      ),
      clearing: false,
      count: { min: 6, max: 6 },
    };
    const clearings = [
      { x: 40, y: 30, radiusX: { min: 3, max: 3 }, path: PATH },
    ];
    const steps = [
      solid,
      placeClearings({ clearings }),
      placeTemplates({ templates: [fence] }),
      addClearingPaths(),
    ] as const;
    const failed: unknown[] = [];

    // when
    const run = () =>
      pipeline(base, steps, {
        random: mulberry32(1),
        onStep: (name) => {
          if (name === 'plantTrees') {
            failed.push(name);
          }
        },
      });

    // then
    expect(run).toThrow('runs through it');
    expect(failed).toHaveLength(3);
  });

  it('makes a bridge where a path spans water', () => {
    // given
    const river = step<object, { streams: Road[] }>(
      'river',
      { adds: ['streams'] },
      (state) => {
        const points = Array.from({ length: 60 }, (_, y) => ({ x: 41, y }));
        for (let y = 0; y < 60; ++y) {
          for (let x = 40; x <= 42; ++x) {
            stampTile(state, x, y, Tile.ShallowWater);
          }
        }
        return { streams: [{ kind: 'road', width: 3, points }] };
      },
    );
    const road = addRoads({
      windiness: 0,
      specs: [{ origin: { x: 5, y: 30 }, angle: 90 }],
    });
    const clearings = [
      { x: 70, y: 30, radiusX: { min: 3, max: 3 }, path: PATH },
    ];
    const steps = [
      solid,
      river,
      road,
      placeClearings({ clearings }),
      addClearingPaths(),
    ] as const;

    // when
    const { grid, bridges } = pipeline(base, steps, { random: mulberry32(1) });

    // then
    expect(grid.get(41, 30)).toBe(Tile.Bridge);
    expect(bridges).toHaveLength(1);
  });

  it('lets a path that does not span water give way to it', () => {
    // given
    const pond = step<object, { streams: Road[] }>(
      'pond',
      { adds: ['streams'] },
      (state) => {
        const points = Array.from({ length: 11 }, (_, at) => ({
          x: 41,
          y: 25 + at,
        }));
        for (let y = 25; y <= 35; ++y) {
          for (let x = 40; x <= 42; ++x) {
            stampTile(state, x, y, Tile.ShallowWater);
          }
        }
        return { streams: [{ kind: 'road', width: 3, points }] };
      },
    );
    // the path from the bottom border ends in the pond, so it joins nothing
    const clearings = [
      { x: 41, y: 30, radiusX: { min: 3, max: 3 }, path: PATH },
    ];
    const steps = [
      solid,
      pond,
      placeClearings({ clearings }),
      addClearingPaths(),
    ] as const;

    // when
    const { grid, bridges } = pipeline(base, steps, { random: mulberry32(1) });

    // then
    expect(grid.get(41, 45)).toBe(Tile.Road);
    expect(grid.get(41, 28)).toBe(Tile.ShallowWater);
    expect(bridges).toEqual([]);
  });

  it('throws a TypeError without clearings in the state', () => {
    // given
    const step = addClearingPaths();
    const state = base();

    // when
    const run = () => step(state as never);

    // then
    expect(run).toThrow(TypeError);
  });

  it('throws a RangeError for an unknown tile or a bad verge', () => {
    // given
    const badTile = () => addClearingPaths({ roadTile: 99 as Tile });
    const badVerge = () => addClearingPaths({ falloff: -1 });

    // then
    expect(badTile).toThrow(RangeError);
    expect(badVerge).toThrow(RangeError);
  });

  it('is deterministic for the same seed', () => {
    // given
    const clearings = [GLADE, { radiusX: { min: 3, max: 3 }, path: PATH }];

    // when
    const a = build(clearings, { seed: 5 });
    const b = build(clearings, { seed: 5 });

    // then
    expect(a.grid.toString()).toBe(b.grid.toString());
    expect(a.roads).toEqual(b.roads);
  });
});
