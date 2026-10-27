import { describe, expect, it } from 'vitest';
import { Tile } from '../core/tile';
import { mulberry32 } from '../test-helpers/mulberry32';
import type { RoomTemplate } from '../rooms/templates/room-template';
import { TemplateCell } from '../rooms/templates/template-cell';
import { TemplatePlacementError } from '../rooms/templates/template-placement-error';
import type { ClearingSpec } from './clearing-spec';
import type { ForestOptions } from './forest-options';
import { generateForest } from './generate-forest';

const { Unused: U, Floor: F, Wall: W } = TemplateCell;

/// every tile is a tree unless something else is put there
const SOLID = { minDensity: 1, maxDensity: 1 };

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

function forest(options: Partial<ForestOptions> = {}, seed = 1) {
  return generateForest({
    width: 80,
    height: 60,
    random: mulberry32(seed),
    ...options,
  });
}

describe('generateForest templates', () => {
  it('centers a template on its clearing', () => {
    // given
    const options = { clearings: [GLADE], templates: [RUIN] };

    // when
    const { templates } = forest(options);

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
    const options = { ...SOLID, clearings: [GLADE], templates: [RUIN] };

    // when
    const { grid } = forest(options);

    // then
    expect(grid.get(40, 30)).toBe(Tile.Floor);
    expect(grid.get(38, 30)).toBe(Tile.Wall);
    expect(grid.get(40, 28)).toBe(Tile.Wall);
  });

  it('leaves the map as it was under unused cells', () => {
    // given
    const bare = forest({ ...SOLID, clearings: [GLADE] });
    const options = { ...SOLID, clearings: [GLADE], templates: [RUIN] };

    // when
    const { grid } = forest(options);

    // then
    expect(grid.get(38, 28)).toBe(bare.grid.get(38, 28));
    expect(grid.get(42, 32)).toBe(bare.grid.get(42, 32));
    expect(grid.get(38, 28)).toBe(Tile.Grass);
  });

  it('places nothing without templates', () => {
    // given
    const options = { clearings: [GLADE] };

    // when
    const { templates } = forest(options);

    // then
    expect(templates).toEqual([]);
  });

  it('places no copy of a template with a chance of 0', () => {
    // given
    const options = {
      clearings: [GLADE],
      templates: [{ ...RUIN, chance: 0 }],
    };

    // when
    const { templates } = forest(options);

    // then
    expect(templates).toEqual([]);
  });

  it('places the copies of a template on different clearings', () => {
    // given
    const clearings = [
      { ...GLADE, x: 20 },
      { ...GLADE, x: 60 },
    ];
    const options = {
      clearings,
      templates: [{ ...RUIN, count: { min: 2, max: 2 } }],
    };

    // when
    const { templates } = forest(options);

    // then
    expect(templates.map(({ clearing }) => clearing).sort()).toEqual([0, 1]);
  });

  it('rotates and mirrors a template as it allows', () => {
    // given
    const arch: RoomTemplate = {
      cells: [[W, F, F, F, F]],
      clearing: true,
      rotate: [90],
    };
    const options = { clearings: [GLADE], templates: [arch] };

    // when
    const { templates } = forest(options);

    // then
    expect(templates[0]).toMatchObject({ width: 1, height: 5, rotation: 90 });
  });

  it('places a template without a clearing at a spot of its own', () => {
    // given
    const options = { templates: [{ ...RUIN, clearing: undefined }] };

    // when
    const { templates } = forest(options);

    // then
    expect(templates).toHaveLength(1);
    expect(templates[0]?.clearing).toBeUndefined();
  });

  it('never covers a road with a template', () => {
    // given
    const roads = {
      windiness: 0,
      width: { min: 3, max: 3 },
      specs: [{ origin: { x: 40, y: 30 }, angle: 0 }],
    };
    const options = {
      roads,
      templates: [{ ...RUIN, clearing: undefined }],
    };

    // when
    const { grid, templates } = forest(options, 4);

    // then
    const [placed] = templates;
    for (let dy = 0; dy < (placed?.height ?? 0); ++dy) {
      for (let dx = 0; dx < (placed?.width ?? 0); ++dx) {
        const tile = grid.get((placed?.x ?? 0) + dx, (placed?.y ?? 0) + dy);
        expect(tile).not.toBe(Tile.Road);
      }
    }
  });

  it('makes a clearing of its own when the only clearing is on a road', () => {
    // given
    const roads = {
      windiness: 0,
      width: { min: 3, max: 3 },
      specs: [{ origin: { x: 40, y: 30 }, angle: 0 }],
    };
    const options = { roads, clearings: [GLADE], templates: [RUIN] };

    // when
    const { templates } = forest(options);

    // then
    expect(templates[0]).toMatchObject({ ownClearing: true });
    expect(templates[0]?.clearing).toBeUndefined();
  });

  it('stops the path to a clearing at the edge of its template', () => {
    // given
    const roads = {
      windiness: 0,
      width: { min: 3, max: 3 },
      specs: [{ origin: { x: 40, y: 10 }, angle: 0 }],
    };
    const clearing = {
      x: 40,
      y: 40,
      radiusX: { min: 4, max: 4 },
      path: { width: 1, windiness: 0 },
    };
    const options = { roads, clearings: [clearing], templates: [RUIN] };

    // when
    const { grid } = forest(options);

    // then
    expect(grid.get(40, 37)).toBe(Tile.Road);
    expect(grid.get(40, 38)).toBe(Tile.Wall);
  });

  it('is deterministic for the same seed', () => {
    // given
    const options = { clearings: [GLADE], templates: [RUIN] };

    // when
    const a = forest(options, 5);
    const b = forest(options, 5);

    // then
    expect(a.grid.toString()).toBe(b.grid.toString());
    expect(a.templates).toEqual(b.templates);
  });

  it('throws a RangeError for a template with an exit', () => {
    // given
    const gate: RoomTemplate = { cells: [[W, TemplateCell.Exit, W]] };
    const options = { templates: [gate] };

    // when
    const generate = () => forest(options);

    // then
    expect(generate).toThrow(RangeError);
  });

  it('throws a TemplatePlacementError for a template bigger than the map', () => {
    // given
    const huge: RoomTemplate = { cells: [Array.from({ length: 90 }, () => F)] };
    const options = { templates: [huge] };

    // when
    const generate = () => forest(options);

    // then
    expect(generate).toThrow(TemplatePlacementError);
  });

  it('makes a clearing of its own for a template when there are no clearings', () => {
    // given
    const options = { ...SOLID, templates: [RUIN] };

    // when
    const { grid, templates } = forest(options);

    // then
    const [placed] = templates;
    expect(placed?.ownClearing).toBe(true);
    expect(grid.get((placed?.x ?? 0) + 2, (placed?.y ?? 0) + 2)).toBe(
      Tile.Floor,
    );
    expect(grid.get(placed?.x ?? 0, placed?.y ?? 0)).toBe(Tile.Grass);
  });

  it('makes a clearing of its own for a template once the clearings have one each', () => {
    // given
    const options = {
      clearings: [GLADE],
      templates: [{ ...RUIN, count: { min: 2, max: 2 } }],
    };

    // when
    const { templates } = forest(options);

    // then
    expect(templates.map(({ ownClearing }) => ownClearing).sort()).toEqual([
      false,
      true,
    ]);
  });

  it('has a template that needs no clearing leave the trees round it', () => {
    // given
    const options = { ...SOLID, templates: [{ ...RUIN, clearing: false }] };

    // when
    const { grid, templates } = forest(options);

    // then
    const [placed] = templates;
    expect(placed?.ownClearing).toBe(false);
    expect(grid.get(placed?.x ?? 0, placed?.y ?? 0)).toBe(Tile.Tree);
  });

  it('thins the trees over the margin of a clearing of its own', () => {
    // given
    const options = {
      ...SOLID,
      templates: [{ ...RUIN, margin: 4 }],
    };

    // when
    const { density, grid, templates } = forest(options);

    // then
    const [placed] = templates;
    const row = (placed?.y ?? 0) + 2;
    const left = placed?.x ?? 0;
    const chance = (away: number) => density[row * grid.width + left - away];
    expect(chance(1)).toBeCloseTo(0.2);
    expect(chance(2)).toBeCloseTo(0.4);
    expect(chance(5)).toBeCloseTo(1);
  });

  it('gives a clearing of its own no margin by default', () => {
    // given
    const options = { ...SOLID, templates: [RUIN] };

    // when
    const { density, grid, templates } = forest(options);

    // then
    const [placed] = templates;
    const at = (placed?.y ?? 0) * grid.width + (placed?.x ?? 0) - 1;
    expect(density[at]).toBeCloseTo(1);
  });

  it('throws a RangeError for a margin that is not a whole number', () => {
    // given
    const options = { templates: [{ ...RUIN, margin: 1.5 }] };

    // when
    const generate = () => forest(options);

    // then
    expect(generate).toThrow(RangeError);
  });

  it('throws a TemplatePlacementError for a template that finds no spot', () => {
    // given
    const wide: RoomTemplate = {
      cells: [Array.from({ length: 80 }, () => F)],
      clearing: false,
    };
    const roads = {
      windiness: 0,
      specs: [{ origin: { x: 40, y: 30 }, angle: 90 }],
    };
    const options = { roads, templates: [wide] };

    // when
    const generate = () => forest(options);

    // then
    expect(generate).toThrow(TemplatePlacementError);
  });
});
