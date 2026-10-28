import { describe, expect, it } from 'vitest';
import { Tile } from '../core/tile';
import { emptyMap } from '../pipeline/empty-map';
import { pipeline } from '../pipeline/pipeline';
import { Reserve } from '../pipeline/reserve';
import { addRoads } from '../streams/add-roads';
import type { AddRoadsOptions } from '../streams/add-roads-options';
import { addStreams } from '../streams/add-streams';
import type { RoomTemplate } from '../rooms/templates/room-template';
import { TemplateCell } from '../rooms/templates/template-cell';
import { TemplatePlacementError } from '../rooms/templates/template-placement-error';
import { mulberry32 } from '../test-helpers/mulberry32';
import type { ClearingSpec } from './clearing-spec';
import type { ForestTemplate } from './forest-template';
import { placeClearings } from './place-clearings';
import { placeTemplates } from './place-templates';
import { plantTrees } from './plant-trees';

const { Unused: U, Floor: F, Wall: W } = TemplateCell;

const base = emptyMap({ width: 80, height: 60, tile: Tile.Grass });

/// every tile is a tree unless something else is put there
const solid = plantTrees({ density: { min: 1, max: 1 } });

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

const GLADE: ClearingSpec = {
  x: 40,
  y: 30,
  radiusX: { min: 6, max: 6 },
  irregularity: 0,
};

/** A road along the row through the middle of the map. */
const ROAD: AddRoadsOptions = {
  windiness: 0,
  width: { min: 3, max: 3 },
  specs: [{ origin: { x: 40, y: 30 }, angle: 0 }],
};

/** Dense trees, then the clearings, then the templates. */
function build(
  templates: RoomTemplate[],
  {
    clearings = [],
    seed = 1,
  }: { clearings?: ClearingSpec[]; seed?: number } = {},
) {
  const options = { random: mulberry32(seed) };
  const place = placeTemplates({ templates });
  return clearings.length > 0
    ? pipeline(base, [solid, placeClearings({ clearings }), place], options)
    : pipeline(base, [solid, place], options);
}

/** The tiles of the box of a placed template. */
function boxTiles(
  grid: { get: (x: number, y: number) => Tile },
  { x, y, width, height }: ForestTemplate,
): Tile[] {
  return Array.from({ length: width * height }, (_, at) =>
    grid.get(x + (at % width), y + Math.floor(at / width)),
  );
}

describe('placeTemplates', () => {
  it('centers a template on its clearing', () => {
    // given
    const clearings = [GLADE];

    // when
    const { templates } = build([RUIN], { clearings });

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
  });

  it('forces the floor and wall cells over the trees', () => {
    // given
    const clearings = [GLADE];

    // when
    const { grid } = build([RUIN], { clearings });

    // then
    expect(grid.get(40, 30)).toBe(Tile.Floor);
    expect(grid.get(38, 30)).toBe(Tile.Wall);
    expect(grid.get(40, 28)).toBe(Tile.Wall);
  });

  it('clears the prunable bit of the cells it stamps', () => {
    // given
    const clearings = [GLADE];

    // when
    const { prunable } = build([RUIN], { clearings });

    // then
    expect(prunable[30 * 80 + 40]).toBe(0);
    expect(prunable[28 * 80 + 40]).toBe(0);
  });

  it('reserves the cells it stamps as solid and nothing else', () => {
    // given
    const clearings = [GLADE];

    // when
    const { reserved, templates } = build([RUIN], { clearings });

    // then
    const [placed] = templates;
    expect(placed).toBeDefined();
    const box = (placed?.width ?? 0) * (placed?.height ?? 0);
    expect(reserved[30 * 80 + 40]).toBe(Reserve.Solid);
    expect(reserved[28 * 80 + 40]).toBe(Reserve.Solid);
    expect(reserved[(placed?.y ?? 0) * 80 + (placed?.x ?? 0)]).toBe(
      Reserve.None,
    );
    expect(reserved.reduce((sum, kind) => sum + kind, 0)).toBe(box - 4);
  });

  it('leaves the map as it was under unused cells', () => {
    // given
    const clearings = [GLADE];
    const bare = build([], { clearings });

    // when
    const { grid } = build([RUIN], { clearings });

    // then
    expect(grid.get(38, 28)).toBe(bare.grid.get(38, 28));
    expect(grid.get(42, 32)).toBe(bare.grid.get(42, 32));
    expect(grid.get(38, 28)).toBe(Tile.Grass);
  });

  it('leaves the trees in the unused cells of a template with no clearing of its own', () => {
    // given
    const arch = { ...RUIN, clearing: false };

    // when
    const { grid, prunable, templates } = build([arch]);

    // then
    const [placed] = templates;
    const at = (placed?.y ?? 0) * 80 + (placed?.x ?? 0);
    expect(grid.get(placed?.x ?? 0, placed?.y ?? 0)).toBe(Tile.Tree);
    expect(prunable[at]).toBe(1);
  });

  it('places nothing without templates', () => {
    // given
    const clearings = [GLADE];

    // when
    const { templates } = build([], { clearings });

    // then
    expect(templates).toEqual([]);
  });

  it('places no copy of a template with a chance of 0', () => {
    // given
    const templates = [{ ...RUIN, chance: 0 }];

    // when
    const result = build(templates, { clearings: [GLADE] });

    // then
    expect(result.templates).toEqual([]);
  });

  it('places the copies of a template on different clearings', () => {
    // given
    const clearings = [
      { ...GLADE, x: 20 },
      { ...GLADE, x: 60 },
    ];
    const templates = [{ ...RUIN, count: { min: 2, max: 2 } }];

    // when
    const result = build(templates, { clearings });

    // then
    expect(result.templates.map(({ clearing }) => clearing).sort()).toEqual([
      0, 1,
    ]);
  });

  it('rotates a template as it allows', () => {
    // given
    const arch: RoomTemplate = {
      cells: [[W, F, F, F, F]],
      clearing: true,
      rotate: [90],
    };

    // when
    const result = build([arch], { clearings: [GLADE] });

    // then
    expect(result.templates[0]).toMatchObject({
      width: 1,
      height: 5,
      rotation: 90,
    });
  });

  it('places a template without a clearing at a spot of its own', () => {
    // given
    const templates = [{ ...RUIN, clearing: undefined }];

    // when
    const result = build(templates);

    // then
    expect(result.templates).toHaveLength(1);
    expect(result.templates[0]?.clearing).toBeUndefined();
  });

  it('works without clearings in the state', () => {
    // given
    const step = placeTemplates({ templates: [RUIN] });
    const state = base();

    // when
    const { templates } = step(state);

    // then
    expect(templates).toHaveLength(1);
    expect(templates[0]?.ownClearing).toBe(true);
  });

  it('never covers a road with a template', () => {
    // given
    const templates = [{ ...RUIN, clearing: undefined }];
    const seeds = [1, 2, 3, 4, 5, 6];

    // when
    const results = seeds.map((seed) => {
      const steps = [
        solid,
        addRoads(ROAD),
        placeTemplates({ templates }),
      ] as const;
      return pipeline(base, steps, { random: mulberry32(seed) });
    });

    // then
    for (const { grid, templates: placed } of results) {
      const [box] = placed;
      expect(boxTiles(grid, box as ForestTemplate)).not.toContain(Tile.Road);
    }
  });

  it('never covers water with a template', () => {
    // given
    const templates = [{ ...RUIN, clearing: false }];
    const seeds = [1, 2, 3, 4, 5, 6];

    // when
    const results = seeds.map((seed) => {
      const steps = [
        solid,
        addStreams({ angle: 0, windiness: 0, width: { min: 3, max: 3 } }),
        placeTemplates({ templates }),
      ] as const;
      return pipeline(base, steps, { random: mulberry32(seed) });
    });

    // then
    for (const { grid, templates: placed } of results) {
      const tiles = boxTiles(grid, placed[0] as ForestTemplate);
      expect(tiles).not.toContain(Tile.ShallowWater);
      expect(tiles).not.toContain(Tile.DeepWater);
    }
  });

  it('makes a clearing of its own when the only clearing is on a road', () => {
    // given
    const steps = [
      solid,
      addRoads(ROAD),
      placeClearings({ clearings: [GLADE] }),
      placeTemplates({ templates: [RUIN] }),
    ] as const;

    // when
    const { templates } = pipeline(base, steps, { random: mulberry32(1) });

    // then
    expect(templates[0]).toMatchObject({ ownClearing: true });
    expect(templates[0]?.clearing).toBeUndefined();
  });

  it('makes a clearing of its own once the clearings have one each', () => {
    // given
    const templates = [{ ...RUIN, count: { min: 2, max: 2 } }];

    // when
    const result = build(templates, { clearings: [GLADE] });

    // then
    expect(
      result.templates.map(({ ownClearing }) => ownClearing).sort(),
    ).toEqual([false, true]);
  });

  it('frees the box of a clearing of its own from trees', () => {
    // given
    const templates = [RUIN];

    // when
    const { grid, templates: placed } = build(templates);

    // then
    const [box] = placed;
    expect(box?.ownClearing).toBe(true);
    expect(grid.get((box?.x ?? 0) + 2, (box?.y ?? 0) + 2)).toBe(Tile.Floor);
    expect(grid.get(box?.x ?? 0, box?.y ?? 0)).toBe(Tile.Grass);
    expect(boxTiles(grid, box as ForestTemplate)).not.toContain(Tile.Tree);
  });

  it('thins the trees over the margin of a clearing of its own', () => {
    // given
    const templates = [{ ...RUIN, margin: 4 }];
    const seeds = Array.from({ length: 300 }, (_, seed) => seed + 1);
    const aways = [1, 2, 5];

    // when
    const trees = [0, 0, 0];
    let counted = 0;
    for (const seed of seeds) {
      const { grid, templates: placed } = build(templates, { seed });
      const [box] = placed;
      const left = box?.x ?? 0;
      const row = (box?.y ?? 0) + 2;
      if (left >= 5) {
        ++counted;
        aways.forEach((away, at) => {
          trees[at] =
            (trees[at] ?? 0) +
            (grid.get(left - away, row) === Tile.Tree ? 1 : 0);
        });
      }
    }
    const shares = trees.map((count) => count / counted);

    // then: a fifth, two fifths, all
    expect(shares[0]).toBeGreaterThan(0.12);
    expect(shares[0]).toBeLessThan(0.28);
    expect(shares[1]).toBeGreaterThan(0.32);
    expect(shares[1]).toBeLessThan(0.48);
    expect(shares[2]).toBe(1);
  });

  it('gives a clearing of its own no margin by default', () => {
    // given
    const templates = [RUIN];

    // when
    const { grid, templates: placed } = build(templates);

    // then
    const [box] = placed;
    expect(grid.get((box?.x ?? 0) - 1, (box?.y ?? 0) + 2)).toBe(Tile.Tree);
  });

  it('is deterministic for the same seed', () => {
    // given
    const clearings = [GLADE];

    // when
    const a = build([RUIN], { clearings, seed: 5 });
    const b = build([RUIN], { clearings, seed: 5 });

    // then
    expect(a.grid.toString()).toBe(b.grid.toString());
    expect(a.templates).toEqual(b.templates);
  });

  it('throws a RangeError for a template with an exit', () => {
    // given
    const gate: RoomTemplate = { cells: [[W, TemplateCell.Exit, W]] };

    // when
    const make = () => placeTemplates({ templates: [gate] });

    // then
    expect(make).toThrow(RangeError);
  });

  it('throws a RangeError for a margin that is not a whole number', () => {
    // given
    const templates = [{ ...RUIN, margin: 1.5 }];

    // when
    const make = () => placeTemplates({ templates });

    // then
    expect(make).toThrow(RangeError);
  });

  it('throws a RangeError for an unknown distance', () => {
    // given
    const distance = 'diagonal' as 'chebyshev';

    // when
    const make = () => placeTemplates({ templates: [RUIN], distance });

    // then
    expect(make).toThrow(RangeError);
  });

  it('throws a TemplatePlacementError at once for a template bigger than the map', () => {
    // given
    const huge: RoomTemplate = { cells: [Array.from({ length: 90 }, () => F)] };
    let stepped = 0;

    // when
    const run = () =>
      pipeline(base, [solid, placeTemplates({ templates: [huge] })], {
        onStep: () => {
          ++stepped;
        },
      });

    // then
    expect(run).toThrow(TemplatePlacementError);
    expect(stepped).toBe(0);
  });

  it('retries the whole map for a template that finds no spot, then throws', () => {
    // given
    const wide: RoomTemplate = {
      cells: [Array.from({ length: 80 }, () => F)],
      clearing: false,
    };
    const roads = {
      windiness: 0,
      specs: [{ origin: { x: 40, y: 30 }, angle: 90 }],
    };
    const steps = [
      solid,
      addRoads(roads),
      placeTemplates({ templates: [wide] }),
    ] as const;
    const planted: string[] = [];

    // when
    const run = () =>
      pipeline(base, steps, {
        random: mulberry32(1),
        onStep: (name) => planted.push(name),
      });

    // then
    expect(run).toThrow(TemplatePlacementError);
    expect(planted.filter((name) => name === 'plantTrees')).toHaveLength(3);
  });
});
