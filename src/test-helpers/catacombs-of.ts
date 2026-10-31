import type { CatacombGroup } from '../rooms/catacomb-group';
import type { RoomGroup } from '../rooms/room-group';

/** The catacombs among the groups, in their order. */
export function catacombsOf(groups: readonly RoomGroup[]): CatacombGroup[] {
  return groups.flatMap((group) => (group.kind === 'catacomb' ? [group] : []));
}
