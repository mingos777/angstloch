import type { CellBlockGroup } from '../rooms/cell-block-group';
import type { RoomGroup } from '../rooms/room-group';

/** The cell blocks among the groups, in their order. */
export function cellBlocksOf(groups: readonly RoomGroup[]): CellBlockGroup[] {
  return groups.flatMap((group) => (group.kind === 'cellBlock' ? [group] : []));
}
