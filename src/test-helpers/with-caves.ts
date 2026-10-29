import type { Area } from '../core/area';
import type { RoomGroup } from '../rooms/room-group';

/** The result with the boxes of its caves, the areas of its `'cave'` groups, as `caverns`. */
export function withCaves<T extends { roomGroups: RoomGroup[] }>(
  result: T,
): T & { caverns: Area[] } {
  return {
    ...result,
    caverns: result.roomGroups.flatMap((group) =>
      group.kind === 'cave' ? [group.area] : [],
    ),
  };
}
