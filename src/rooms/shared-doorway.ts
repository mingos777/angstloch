import { cellAt } from './cell-at';
import { DIRECTIONS } from '../core/directions';
import { TemplateCell } from './templates/template-cell';
import type { TemplateExit } from './templates/template-exit';
import type { TemplatePlacement } from './templates/template-placement';

/**
 * Whether an exit of a placement, leaving in a direction, is also an `Exit` or
 * `Door` cell of another placement that leaves the other way. The two rooms
 * then share the doorway, with the floor of one on each side of it.
 */
export function sharedDoorway(
  placement: TemplatePlacement,
  exit: TemplateExit,
  direction: number,
  other: TemplatePlacement,
): boolean {
  const step = DIRECTIONS[direction];
  const [x, y] = [placement.x + exit.x, placement.y + exit.y];
  const theirs = other.exits.find(
    (candidate) => other.x + candidate.x === x && other.y + candidate.y === y,
  );
  return (
    step !== undefined &&
    theirs !== undefined &&
    theirs.kind !== TemplateCell.OptionalExit &&
    exit.kind !== TemplateCell.OptionalExit &&
    theirs.directions.includes((direction + 2) % 4) &&
    cellAt(other, x + step.x, y + step.y) === TemplateCell.Floor &&
    cellAt(placement, x - step.x, y - step.y) === TemplateCell.Floor
  );
}
