import { createConnectedParts } from '../rooms/create-connected-parts';
import type { Exit } from '../rooms/exit';
import type { Grid } from '../core/grid';
import type { MazeOpening } from '../rooms/maze-opening';
import type { Random } from '../core/random';
import { randomInt } from '../core/random-int';
import type { Range } from '../core/range';
import type { Room } from '../rooms/room';
import { Tile } from '../core/tile';

function takeRandom<T>(random: Random, items: T[]): T | undefined {
  return items.splice(randomInt(random, 0, items.length - 1), 1)[0];
}

/**
 * Opens the walls of the rooms onto the maze, in place, and returns the exits.
 * Fixed openings are always made. Each room then draws a number of openings
 * from `exitsPerRoom`, fixed ones included, and gets more from the rest.
 * Afterwards more openings are made wherever they join parts of the map that
 * are not connected yet, such as a stretch of maze that a room cuts off. Walls
 * open as a door with the chance `doorChance` unless the opening says so.
 */
export function openMazeOpenings(
  grid: Grid,
  random: Random,
  rooms: Room[],
  openings: MazeOpening[],
  exitsPerRoom: Range,
  doorChance: number,
): Exit[] {
  const exits: Exit[] = [];

  const open = ({ room, wall, door: decided }: MazeOpening): void => {
    const door = decided ?? doorChance > random();
    grid.set(wall.x, wall.y, door ? Tile.Door : Tile.Floor);
    room.exits.push(exits.length);
    ++room.exitCount;
    if (door) {
      ++room.doorCount;
    }
    exits.push({ position: wall, rooms: [room.id], door });
  };

  const isClosed = ({ wall }: MazeOpening): boolean =>
    grid.get(wall.x, wall.y) === Tile.Wall;

  const spare: MazeOpening[] = [];
  for (const room of rooms) {
    const usable = openings.filter(
      (opening) =>
        opening.room === room &&
        grid.get(opening.outside.x, opening.outside.y) === Tile.Floor &&
        (opening.fixed === true ||
          grid.get(opening.inside.x, opening.inside.y) !== Tile.Wall),
    );
    for (const opening of usable.filter(({ fixed }) => fixed)) {
      if (isClosed(opening)) {
        open(opening);
      }
    }
    const rest = usable.filter(({ fixed }) => !fixed);
    const wanted = randomInt(random, exitsPerRoom.min, exitsPerRoom.max);
    while (room.exitCount < wanted && rest.length > 0) {
      const opening = takeRandom(random, rest);
      if (opening && isClosed(opening)) {
        open(opening);
      }
    }
    spare.push(...rest);
  }

  // parts of the map that are still apart are joined by spare openings
  const parts = createConnectedParts(grid);
  for (
    let opening = takeRandom(random, spare);
    opening;
    opening = takeRandom(random, spare)
  ) {
    if (
      isClosed(opening) &&
      !parts.connected(opening.inside, opening.outside)
    ) {
      parts.join(opening.inside, opening.outside);
      open(opening);
    }
  }
  return exits;
}
