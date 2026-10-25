import { createDungeonBuilder } from './dungeon-builder';
import type { DungeonBuilderOptions, UnconnectedExit } from './dungeon-builder';
import type { Exit } from '../rooms/exit';
import type { Grid } from '../core/grid';
import type { Random } from '../core/random';
import type { Room } from '../rooms/room';

export interface Connections {
  exits: Exit[];
  /** Ids of rooms that could not be joined to the biggest group of connected rooms. */
  stranded: number[];
  /** Fixed exits of templated rooms that could not be opened or joined to the rest of the dungeon. */
  unconnected: UnconnectedExit[];
}

/**
 * Joins every room to the others with corridors, shortest links first and only
 * between rooms that are not connected yet. Rooms that face each other across a
 * single wall are joined by a door in that wall instead. Corridors and exits
 * are carved into the grid, and every exit is recorded on its rooms.
 *
 * A room that cannot reach another room may join any corridor instead. Rooms
 * that cannot be joined at all are reported as stranded.
 *
 * Every fixed exit of a templated room gets a corridor too. Once the rooms are
 * connected, extra links give rooms the number of exits
 * they ask for and add loops, and dead ends sprout from corridors.
 */
export function connectRooms(
  grid: Grid,
  rooms: Room[],
  random: Random,
  options: DungeonBuilderOptions,
): Connections {
  const builder = createDungeonBuilder(grid, rooms, random, options);
  if (rooms.length < 2) {
    return {
      exits: builder.exits,
      stranded: [],
      unconnected: builder.connectStubs(),
    };
  }
  const stranded = builder.connectAll();
  const unconnected = stranded.length === 0 ? builder.connectStubs() : [];
  if (stranded.length === 0 && unconnected.length === 0) {
    builder.addExtras(true);
  }
  return { exits: builder.exits, stranded, unconnected };
}
