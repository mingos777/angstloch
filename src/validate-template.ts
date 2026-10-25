import { assertFraction } from './assert-fraction';
import { assertRange } from './assert-range';
import { assertWholeNumber } from './assert-whole-number';
import { DIRECTIONS } from './directions';
import { findTemplateExits } from './find-template-exits';
import type { RoomTemplate } from './room-template';
import { TemplateCell } from './template-cell';

const ROTATIONS: readonly number[] = [0, 90, 180, 270];
const ANCHORS: readonly string[] = [
  'center',
  'top',
  'bottom',
  'left',
  'right',
  'top-left',
  'top-right',
  'bottom-left',
  'bottom-right',
];
const CELLS: readonly number[] = Object.values(TemplateCell);
const OPEN: readonly number[] = [
  TemplateCell.Floor,
  TemplateCell.Exit,
  TemplateCell.Door,
  TemplateCell.OptionalExit,
];
const CELL_NAMES: Record<number, string> = {
  [TemplateCell.Floor]: 'floor',
  [TemplateCell.Exit]: 'exit',
  [TemplateCell.Door]: 'door',
  [TemplateCell.OptionalExit]: 'optional exit',
};

/**
 * Throws a `RangeError` naming the template unless it is usable: a
 * rectangular design with at least one exit on its boundary, open cells that
 * are walled in (diagonals included), and consistent placement settings.
 */
export function validateTemplate(template: RoomTemplate, index: number): void {
  const label =
    template.name === undefined
      ? `Template #${String(index)}`
      : `Template "${template.name}" (#${String(index)})`;
  const fail = (problem: string): never => {
    throw new RangeError(`${label}: ${problem}`);
  };
  const { cells } = template;

  const width = cells[0]?.length ?? 0;
  if (cells.length === 0 || width === 0) {
    fail('cells must not be empty');
  }
  cells.forEach((row, y) => {
    if (row.length !== width) {
      fail(
        `row ${String(y)} has ${String(row.length)} cells, expected ${String(width)}`,
      );
    }
    row.forEach((cell, x) => {
      if (!CELLS.includes(cell)) {
        fail(`unknown cell ${String(cell)} at (${String(x)}, ${String(y)})`);
      }
    });
  });

  // Games may allow diagonal moves, so open cells are checked against all
  // eight neighbors. Only an exit's outward side may face outside.
  const exitAt = new Map(
    findTemplateExits(cells).map((exit) => [
      `${String(exit.x)},${String(exit.y)}`,
      exit,
    ]),
  );
  cells.forEach((row, y) => {
    row.forEach((cell, x) => {
      if (!OPEN.includes(cell)) {
        return;
      }
      const outward = exitAt.get(`${String(x)},${String(y)}`)?.directions ?? [];
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const neighbor = cells[y + dy]?.[x + dx];
          if (neighbor !== undefined && neighbor !== TemplateCell.Unused) {
            continue;
          }
          const faces = outward.some((direction) => {
            const step = DIRECTIONS[direction];
            return (
              step !== undefined &&
              (step.x === 0 || step.x === dx) &&
              (step.y === 0 || step.y === dy) &&
              (step.x !== 0 || step.y !== 0)
            );
          });
          if (!faces) {
            fail(
              `${CELL_NAMES[cell] ?? 'cell'} at (${String(x)}, ${String(y)}) is not walled in`,
            );
          }
        }
      }
    });
  });

  if (findTemplateExits(cells).length === 0) {
    fail('needs an exit, door or optional exit cell on its boundary');
  }

  if (template.count !== undefined) {
    withLabel(label, () => {
      assertRange(
        'count',
        template.count as NonNullable<typeof template.count>,
        0,
      );
    });
  }
  if (template.rotate !== undefined) {
    if (template.rotate.length === 0) {
      fail('rotate must not be empty');
    }
    for (const rotation of template.rotate) {
      if (!ROTATIONS.includes(rotation)) {
        fail(`rotate must hold 0, 90, 180 or 270, got ${String(rotation)}`);
      }
    }
  }
  if (template.positionAccuracy !== undefined) {
    withLabel(label, () => {
      assertFraction('positionAccuracy', template.positionAccuracy as number);
    });
  }

  template.areas?.forEach((area, i) => {
    withLabel(label, () => {
      assertWholeNumber(`areas[${String(i)}].x`, area.x, 0);
      assertWholeNumber(`areas[${String(i)}].y`, area.y, 0);
      assertWholeNumber(`areas[${String(i)}].width`, area.width, 1);
      assertWholeNumber(`areas[${String(i)}].height`, area.height, 1);
    });
  });

  const allowed = template.rotate ?? [0];
  template.positions?.forEach((position, i) => {
    if (!ANCHORS.includes(position.anchor)) {
      fail(`positions[${String(i)}].anchor is unknown: ${position.anchor}`);
    }
    if (position.rotations === undefined) {
      return;
    }
    for (const rotation of position.rotations) {
      if (!ROTATIONS.includes(rotation)) {
        fail(`positions[${String(i)}].rotations holds ${String(rotation)}`);
      }
    }
    if (!position.rotations.some((rotation) => allowed.includes(rotation))) {
      fail(
        `positions[${String(i)}].rotations has no rotation in common with rotate`,
      );
    }
  });
}

/** Re-throws a `RangeError` of an assertion with the template label in front. */
function withLabel(label: string, check: () => void): void {
  try {
    check();
  } catch (error) {
    if (error instanceof RangeError) {
      throw new RangeError(`${label}: ${error.message}`, { cause: error });
    }
    throw error;
  }
}
