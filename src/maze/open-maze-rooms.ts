import { assertFraction } from '../core/assert-fraction';
import { assertRange } from '../core/assert-range';
import type { MapStep } from '../pipeline/map-step';
import { openReserved } from '../pipeline/open-reserved';
import { Reserve } from '../pipeline/reserve';
import { step } from '../pipeline/step';
import type { Exit } from '../rooms/exit';
import type { MazeOpening } from '../rooms/maze-opening';
import type { Room } from '../rooms/room';
import type { RoomShape } from '../rooms/room-shape';
import { findTemplateOpenings } from '../rooms/templates/find-template-openings';
import { TemplatePlacementError } from '../rooms/templates/template-placement-error';
import type { OpenMazeRoomsOptions } from './open-maze-rooms-options';
import { openMazeOpenings } from './open-maze-openings';
import { reachFixedExits } from './reach-fixed-exits';

/** The extras that `openMazeRooms` needs. */
interface PlacedRooms {
  rooms: Room[];
  roomShapes: RoomShape[];
}

/** The extras that `openMazeRooms` adds. */
interface OpenedRooms {
  rooms: Room[];
  roomExits: Exit[];
}

/**
 * A step that opens the rooms onto the maze round them, the rooms of
 * `placeMazeRooms` after `digMaze`. Only rooms that have no exits yet are
 * opened. A room's openings come from its shape in `roomShapes`: the potential
 * exits that face a maze cell (odd coordinates, not reserved), and are still
 * `Openable`. The fixed exits of templates come first: the maze is carved up
 * to each that it has not reached, and one that cannot be reached fails the
 * attempt with a `TemplatePlacementError`, which `pipeline` retries. Each room
 * then draws a number of openings from `exitsPerRoom`, fixed ones included,
 * and more are made wherever they join parts of the map that are not joined
 * yet, such as a stretch of maze that a room cuts off. An opening gets a door
 * with the chance `doorChance`, unless the template decided it.
 *
 * Every opening goes through `openReserved`. It needs `rooms` and
 * `roomShapes`, uses `roomExits` from the steps before it, and adds `rooms`
 * and `roomExits` again, with the exits of the rooms it opened appended.
 * Throws a `RangeError` at once for a bad option.
 */
export function openMazeRooms(
  options: OpenMazeRoomsOptions = {},
): MapStep<PlacedRooms & Partial<OpenedRooms>, OpenedRooms> {
  const { exitsPerRoom = { min: 1, max: 3 }, doorChance = 1 } = options;
  assertRange('exitsPerRoom', exitsPerRoom, 1);
  assertFraction('doorChance', doorChance);

  return step<PlacedRooms & Partial<OpenedRooms>, OpenedRooms>(
    'openMazeRooms',
    { needs: ['rooms', 'roomShapes'], adds: ['rooms', 'roomExits'] },
    (state, { random }) => {
      const { grid, reserved } = state;
      const { width, height } = grid;
      const isBlocked = (x: number, y: number): boolean =>
        reserved[y * width + x] !== Reserve.None;

      // the rooms to open are copied, since the opening counts their exits
      const opened = new Map<number, Room>();
      const openings: MazeOpening[] = [];
      for (const room of state.rooms) {
        const shape = state.roomShapes[room.id];
        if (room.exitCount > 0 || !shape) {
          continue;
        }
        const copy: Room = { ...room, exits: [] };
        opened.set(room.id, copy);
        const doors = new Map(
          shape.doors.map(({ x, y, door }) => [y * width + x, door]),
        );
        openings.push(
          ...findTemplateOpenings(
            shape,
            copy,
            doors,
            width,
            height,
            isBlocked,
          ).filter(
            ({ wall }) =>
              reserved[wall.y * width + wall.x] === Reserve.Openable,
          ),
        );
      }

      reachFixedExits(grid, openings, isBlocked, ({ room, wall }) => {
        throw new TemplatePlacementError(
          room.template ?? 0,
          undefined,
          `the exit at (${String(wall.x)}, ${String(wall.y)}) of room ${String(room.id)} cannot be joined to the maze`,
        );
      });
      const exits = openMazeOpenings(
        grid,
        random,
        [...opened.values()],
        openings,
        exitsPerRoom,
        doorChance,
      );
      for (const { position } of exits) {
        openReserved(state, position.x, position.y);
      }

      // the new exits follow on from the ones there are
      const firstExit = state.roomExits?.length ?? 0;
      const rooms = state.rooms.map((room) => {
        const copy = opened.get(room.id);
        return copy
          ? { ...copy, exits: copy.exits.map((exit) => exit + firstExit) }
          : room;
      });
      return { rooms, roomExits: [...(state.roomExits ?? []), ...exits] };
    },
  );
}
