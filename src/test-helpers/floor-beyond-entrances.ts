import { DIRECTIONS } from '../core/directions';
import { Tile } from '../core/tile';
import { step } from '../pipeline/step';
import type { RoomGroup } from '../rooms/room-group';

/** A step that digs two tiles in a row beyond the entrance of every cell block, as a hall dug right up to it would, starting `from` tiles out (1, right beyond it). */
export function floorBeyondEntrances(from = 1) {
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
        for (const k of [from, from + 1]) {
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
