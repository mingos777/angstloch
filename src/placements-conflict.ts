import { cellAt } from './cell-at';
import { roomsConflict } from './rooms-conflict';
import { sharedDoorway } from './shared-doorway';
import { TemplateCell } from './template-cell';
import type { TemplatePlacement } from './template-placement';

/** Walls, which two rooms can share, and optional exits, which stay walls where they are not opened. */
function isWall(cell: TemplateCell): boolean {
  return cell === TemplateCell.Wall || cell === TemplateCell.OptionalExit;
}

/** Whether two placements may have a cell on the same tile: walls may be shared, and so may a doorway that both rooms have, facing each other. */
function mayShare(
  a: TemplatePlacement,
  b: TemplatePlacement,
  x: number,
  y: number,
): boolean {
  const [first, second] = [cellAt(a, x, y), cellAt(b, x, y)];
  if (isWall(first) && isWall(second)) {
    return true;
  }
  const exit = a.exits.find(
    (candidate) => a.x + candidate.x === x && a.y + candidate.y === y,
  );
  return (
    exit?.kind !== TemplateCell.OptionalExit &&
    (exit?.directions.some((direction) =>
      sharedDoorway(a, exit, direction, b),
    ) ??
      false)
  );
}

/**
 * Whether two placements collide. With a `spacing` of 1 they may touch and
 * share walls, but not floors, and a doorway only if both have it, facing each
 * other. With more spacing, the footprints, every cell but the unused ones,
 * must be more than `spacing` tiles apart.
 */
export function placementsConflict(
  a: TemplatePlacement,
  b: TemplatePlacement,
  spacing: number,
): boolean {
  if (spacing > 1) {
    return crowded(a, b, spacing);
  }
  const left = Math.max(a.x, b.x);
  const top = Math.max(a.y, b.y);
  const right = Math.min(a.x + a.width, b.x + b.width);
  const bottom = Math.min(a.y + a.height, b.y + b.height);
  for (let y = top; y < bottom; y++) {
    for (let x = left; x < right; x++) {
      if (
        cellAt(a, x, y) !== TemplateCell.Unused &&
        cellAt(b, x, y) !== TemplateCell.Unused &&
        !mayShare(a, b, x, y)
      ) {
        return true;
      }
    }
  }
  return false;
}

/** Whether the footprints of two placements, every cell but the unused ones, are `spacing` tiles apart or fewer, sharing walls or not. */
export function crowded(
  a: TemplatePlacement,
  b: TemplatePlacement,
  spacing: number,
): boolean {
  if (!roomsConflict(a, b, spacing)) {
    return false;
  }
  for (let y = 0; y < a.height; y++) {
    for (let x = 0; x < a.width; x++) {
      if (cellAt(a, a.x + x, a.y + y) === TemplateCell.Unused) {
        continue;
      }
      for (let ny = a.y + y - spacing; ny <= a.y + y + spacing; ny++) {
        for (let nx = a.x + x - spacing; nx <= a.x + x + spacing; nx++) {
          if (cellAt(b, nx, ny) !== TemplateCell.Unused) {
            return true;
          }
        }
      }
    }
  }
  return false;
}
