import { DIRECTIONS } from './directions';
import type { MazeOpening } from './maze-opening';
import type { Room } from './room';
import { TemplateCell } from './template-cell';
import type { TemplatePlacement } from './template-placement';

/**
 * Lists the ways to open the exits of a templated room onto a maze cell: odd
 * coordinates inside the map, not blocked. `Exit` and `Door` cells are fixed
 * and decided by `doors`; `OptionalExit` cells are not.
 */
export function findTemplateOpenings(
  placement: TemplatePlacement,
  room: Room,
  doors: ReadonlyMap<number, boolean>,
  width: number,
  height: number,
  isBlocked: (x: number, y: number) => boolean,
): MazeOpening[] {
  const openings: MazeOpening[] = [];
  for (const exit of placement.exits) {
    const wall = { x: placement.x + exit.x, y: placement.y + exit.y };
    const fixed = exit.kind !== TemplateCell.OptionalExit;
    for (const direction of exit.directions) {
      const step = DIRECTIONS[direction];
      if (step === undefined) {
        continue;
      }
      const outside = { x: wall.x + step.x, y: wall.y + step.y };
      if (
        outside.x >= 1 &&
        outside.y >= 1 &&
        outside.x <= width - 2 &&
        outside.y <= height - 2 &&
        outside.x % 2 === 1 &&
        outside.y % 2 === 1 &&
        !isBlocked(outside.x, outside.y)
      ) {
        openings.push({
          room,
          wall,
          inside: { x: wall.x - step.x, y: wall.y - step.y },
          outside,
          door: fixed ? doors.get(wall.y * width + wall.x) : undefined,
          fixed,
        });
      }
    }
  }
  return openings;
}
