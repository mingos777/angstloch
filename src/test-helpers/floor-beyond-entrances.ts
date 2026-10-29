import { DIRECTIONS } from '../core/directions';
import { Tile } from '../core/tile';
import { step } from '../pipeline/step';
import type { RoomGroup } from '../rooms/room-group';

/** A step that digs the two tiles beyond the entrance of every cell block, as a hall dug right up to it would. */
export function floorBeyondEntrances() {
  return step<{ roomGroups: RoomGroup[] }>(
    'floorBeyondEntrances',
    { needs: ['roomGroups'] },
    ({ grid, roomGroups }) => {
      for (const group of roomGroups) {
        if (group.kind !== 'cellBlock') {
          continue;
        }
        const { entrance } = group;
        const inward = DIRECTIONS.find(
          ({ x, y }) => grid.get(entrance.x + x, entrance.y + y) !== Tile.Wall,
        );
        for (const k of [1, 2]) {
          grid.set(
            entrance.x - k * (inward?.x ?? 0),
            entrance.y - k * (inward?.y ?? 0),
            Tile.Floor,
          );
        }
      }
      return {};
    },
  );
}
