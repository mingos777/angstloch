import type { RoomGroup } from '../rooms/room-group';
import type { SewerGroup } from '../rooms/sewer-group';

/** The sewers among the groups, in their order. */
export function sewersOf(groups: readonly RoomGroup[]): SewerGroup[] {
  return groups.flatMap((group) => (group.kind === 'sewer' ? [group] : []));
}
