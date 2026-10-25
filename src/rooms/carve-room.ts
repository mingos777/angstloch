import type { Grid } from '../core/grid';
import type { Room } from './room';
import { Tile } from '../core/tile';

/** Turns the floor area of a room into floor tiles, in place. */
export function carveRoom(grid: Grid, room: Room): void {
  for (let y = room.y; y < room.y + room.height; ++y) {
    for (let x = room.x; x < room.x + room.width; ++x) {
      grid.set(x, y, Tile.Floor);
    }
  }
}
