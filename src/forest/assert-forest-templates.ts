import { assertFraction } from '../core/assert-fraction';
import { assertWholeNumber } from '../core/assert-whole-number';
import { assertRange } from '../core/assert-range';
import type { RoomTemplate } from '../rooms/templates/room-template';
import { TemplateCell } from '../rooms/templates/template-cell';

const ROTATIONS: readonly number[] = [0, 90, 180, 270];
const CELLS: readonly number[] = Object.values(TemplateCell);
const EXITS: readonly number[] = [
  TemplateCell.Exit,
  TemplateCell.Door,
  TemplateCell.OptionalExit,
];

/**
 * Throws a `RangeError` naming the template unless every template can be
 * placed in a forest: a rectangular design of known cells, without exits
 * (there are no corridors in a forest to join them), with a valid `count`,
 * `chance`, `margin` and `rotate`, and without `positions` and `areas`.
 */
export function assertForestTemplates(
  templates: readonly RoomTemplate[],
): void {
  templates.forEach((template, index) => {
    const label =
      template.name === undefined
        ? `Template #${String(index)}`
        : `Template "${template.name}" (#${String(index)})`;
    const fail = (problem: string): never => {
      throw new RangeError(`${label}: ${problem}`);
    };
    const width = template.cells[0]?.length ?? 0;
    if (template.cells.length === 0 || width === 0) {
      fail('cells must not be empty');
    }
    template.cells.forEach((row, y) => {
      if (row.length !== width) {
        fail(
          `row ${String(y)} has ${String(row.length)} cells, expected ${String(width)}`,
        );
      }
      row.forEach((cell, x) => {
        if (!CELLS.includes(cell)) {
          fail(`unknown cell ${String(cell)} at (${String(x)}, ${String(y)})`);
        }
        if (EXITS.includes(cell)) {
          fail(
            `has an exit, door or optional exit cell at (${String(x)}, ${String(y)}), which means nothing in a forest, where there are no tunnels to join`,
          );
        }
      });
    });
    if (template.rotate?.some((rotation) => !ROTATIONS.includes(rotation))) {
      fail('rotate may only list 0, 90, 180 and 270');
    }
    if (template.count) {
      assertRange(`${label}: count`, template.count, 0);
    }
    if (template.margin !== undefined) {
      assertWholeNumber(`${label}: margin`, template.margin, 0);
    }
    if (template.chance !== undefined) {
      assertFraction(`${label}: chance`, template.chance);
    }
    if (template.positions !== undefined || template.areas !== undefined) {
      fail('positions and areas are not supported in a forest');
    }
  });
}
