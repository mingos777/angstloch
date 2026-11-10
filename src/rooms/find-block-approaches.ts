import { DIRECTIONS } from '../core/directions';
import type { Point } from '../core/point';
import { Tile } from '../core/tile';
import type { MapState } from '../pipeline/map-state';
import { Reserve } from '../pipeline/reserve';
import type { RoomGroup } from './room-group';

/**
 * The approaches of the cell blocks among the `groups` whose entrance is not
 * opened yet (still reserved `Openable`): the tile right in front of the
 * entrance, on the side away from the block. The side is found on the grid: of
 * the entrance's four neighbors, exactly one is open ground (the corridor, the
 * tunnel or the guard room), and the approach is the tile opposite. An
 * entrance with no such neighbor, or more than one, gives no approach.
 */
export function findBlockApproaches(
  state: Pick<MapState, 'grid' | 'reserved'>,
  groups: readonly RoomGroup[],
): Point[] {
  const { grid, reserved } = state;
  return groups.flatMap((group): Point[] => {
    if (group.kind !== 'cellBlock') {
      return [];
    }
    const { x, y } = group.entrance;
    if (
      !grid.inBounds(x, y) ||
      reserved[y * grid.width + x] !== Reserve.Openable
    ) {
      return [];
    }
    const inside = DIRECTIONS.filter(
      (step) => grid.get(x + step.x, y + step.y) !== Tile.Wall,
    );
    const [step] = inside;
    return step && inside.length === 1
      ? [{ x: x - step.x, y: y - step.y }]
      : [];
  });
}
