import { DIRECTIONS } from './directions';
import { EDGE_CLEARANCE } from './room-plan';
import type { PlacementArea } from './placement-area';
import { cellAt } from './cell-at';
import { placementsConflict } from './placements-conflict';
import { sharedDoorway } from './shared-doorway';
import { TemplateCell } from './template-cell';
import type { TemplatePlacement } from './template-placement';

/** Why a spot is no good: the footprint collides, or an exit has nowhere to lead. */
export type SpotProblem = 'conflict' | 'exit';

/**
 * Checks a placement that lies within the map. It must keep its distance from
 * the obstacles, every `Exit` and `Door` needs a free tile for a corridor to
 * start from (on the lattice, one that corridors can use) or a doorway that
 * another room shares, and at least one exit candidate of any kind needs the
 * tile for a corridor, so that the room can reach out on its own.
 */
export function checkTemplateSpot(
  placement: TemplatePlacement,
  area: PlacementArea,
  obstacles: readonly TemplatePlacement[],
): SpotProblem | undefined {
  if (
    obstacles.some((other) =>
      placementsConflict(placement, other, area.spacing),
    )
  ) {
    return 'conflict';
  }
  let anyOutside = false;
  for (const exit of placement.exits) {
    const outside = exit.directions.some((direction) => {
      const step = DIRECTIONS[direction];
      if (step === undefined) {
        return false;
      }
      const x = placement.x + exit.x + step.x;
      const y = placement.y + exit.y + step.y;
      return (
        x >= EDGE_CLEARANCE &&
        y >= EDGE_CLEARANCE &&
        x < area.width - EDGE_CLEARANCE &&
        y < area.height - EDGE_CLEARANCE &&
        (!area.lattice || (x % 2 === 1 && y % 2 === 1)) &&
        obstacles.every((other) => cellAt(other, x, y) === TemplateCell.Unused)
      );
    });
    anyOutside ||= outside;
    // a doorway that another room has, facing this one, needs no corridor
    const doorway = exit.directions.some((direction) =>
      obstacles.some((other) =>
        sharedDoorway(placement, exit, direction, other),
      ),
    );
    if (!outside && !doorway && exit.kind !== TemplateCell.OptionalExit) {
      return 'exit';
    }
  }
  return anyOutside ? undefined : 'exit';
}
