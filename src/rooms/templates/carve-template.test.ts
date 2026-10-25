import { describe, expect, it } from 'vitest';
import { carveTemplate } from './carve-template';
import { findTemplateExits } from './find-template-exits';
import { Grid } from '../../core/grid';
import { TemplateCell } from './template-cell';
import type { TemplatePlacement } from './template-placement';
import { Tile } from '../../core/tile';

const {
  Unused: U,
  Floor: F,
  Wall: W,
  Exit: E,
  Door: D,
  OptionalExit: O,
} = TemplateCell;

function carved(cells: TemplateCell[][], doors = new Map<number, boolean>()) {
  const placement: TemplatePlacement = {
    x: 1,
    y: 1,
    width: cells[0]?.length ?? 0,
    height: cells.length,
    cells,
    exits: findTemplateExits(cells),
    rotation: 0,
    mirrored: false,
  };
  const grid = new Grid(7, 7);
  carveTemplate(grid, placement, doors);
  return grid;
}

describe('carveTemplate', () => {
  it('carves floors', () => {
    // given
    const cells = [
      [W, E, W],
      [W, F, W],
      [W, W, W],
    ];

    // when
    const grid = carved(cells);

    // then
    expect(grid.get(2, 2)).toBe(Tile.Floor);
  });

  it('leaves exits that lead outside for the builder', () => {
    // given
    const cells = [
      [W, E, W],
      [W, F, W],
      [W, W, W],
    ];

    // when
    const grid = carved(cells);

    // then
    expect(grid.get(2, 1)).toBe(Tile.Wall);
  });

  it('leaves optional exits and unused cells as walls', () => {
    // given
    const cells = [
      [U, O, W],
      [W, F, W],
      [W, W, W],
    ];

    // when
    const grid = carved(cells);

    // then
    expect([grid.get(1, 1), grid.get(2, 1)]).toEqual([Tile.Wall, Tile.Wall]);
  });

  it('turns an internal door into a door', () => {
    // given
    const cells = [
      [W, W, W, W, W],
      [W, F, D, F, W],
      [W, W, W, W, W],
      [W, W, E, W, W],
    ];

    // when
    const grid = carved(cells, new Map([[2 * 7 + 3, true]]));

    // then
    expect(grid.get(3, 2)).toBe(Tile.Door);
  });

  it('turns an internal exit without a door into floor', () => {
    // given
    const cells = [
      [W, W, W, W, W],
      [W, F, E, F, W],
      [W, W, W, W, W],
      [W, W, E, W, W],
    ];

    // when
    const grid = carved(cells, new Map([[2 * 7 + 3, false]]));

    // then
    expect(grid.get(3, 2)).toBe(Tile.Floor);
  });
});
