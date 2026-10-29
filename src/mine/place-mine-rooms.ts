import type { Exit } from '../rooms/exit';
import { createSimplexNoise } from '../noise/create-simplex-noise';
import type { MapStep } from '../pipeline/map-step';
import { openReserved } from '../pipeline/open-reserved';
import { step } from '../pipeline/step';
import { reserveRoomShape } from '../rooms/reserve-room-shape';
import type { Room } from '../rooms/room';
import type { RoomShape } from '../rooms/room-shape';
import { assertMineRoomOptions } from './assert-mine-room-options';
import { assertWallBase } from '../pipeline/assert-wall-base';
import { LANE_SPACING } from '../veins/dig-vein';
import { layRooms } from './lay-rooms';
import type { MinePassage } from '../veins/mine-passage';
import type { PlaceMineRoomsOptions } from './place-mine-rooms-options';

/** The extras that `placeMineRooms` uses and adds. */
interface MineRooms {
  passages: MinePassage[];
  rooms: Room[];
  roomExits: Exit[];
  roomShapes: RoomShape[];
}

/**
 * A step that places rooms in the rock beside the floor that is there, a mine
 * or anything else, and joins each to it by a tunnel from every exit it opens:
 * the templates first, then the ordinary rooms, each as near the floor as it
 * can find room for, apart from it and from each other. An ordinary room that
 * finds no room, or cannot be joined, is left out; a template that cannot be
 * placed or joined fails the attempt, which `pipeline` retries.
 *
 * The rooms reserve their footprint (see `reserveRoomShape`), and every exit
 * they open goes through `openReserved`. No room or tunnel is built on a
 * reserved tile, and the floor of a reserved tile, such as an earlier room's,
 * is not floor to join. It uses `passages`, `rooms`, `roomExits` and
 * `roomShapes` from the steps before it, and adds them again with its own
 * appended: the ids of its rooms and the indices of their exits follow on.
 * The map has to start as wall, which `pipeline` checks before the first
 * attempt. Throws a `RangeError` at once for a bad option or template.
 */
export function placeMineRooms(
  options: PlaceMineRoomsOptions = {},
): MapStep<Partial<MineRooms>, MineRooms> {
  const {
    roomCount = { min: 1, max: 1 },
    roomWidth = { min: 3, max: 7 },
    roomHeight = { min: 3, max: 7 },
    sizeUniformity = 0,
    templates = [],
    exitsPerRoom = { min: 1, max: 3 },
    doorChance = 1,
    veinWidth = { min: 1, max: 2 },
    veinWindiness = 0.5,
  } = options;
  assertMineRoomOptions(options);

  return step<Partial<MineRooms>, MineRooms>(
    'placeMineRooms',
    {
      adds: ['passages', 'rooms', 'roomExits', 'roomShapes'],
      validate: (state) => {
        assertWallBase('placeMineRooms', state);
      },
    },
    (state, { random }) => {
      const passages = [...(state.passages ?? [])];
      const rooms = [...(state.rooms ?? [])];
      const roomExits = [...(state.roomExits ?? [])];
      const roomShapes = [...(state.roomShapes ?? [])];
      const laid = layRooms(
        state.grid,
        random,
        createSimplexNoise(random),
        {
          rooms: {
            count: roomCount,
            width: roomWidth,
            height: roomHeight,
            sizeUniformity,
          },
          templates,
          doorChance,
          exitsPerRoom,
          veinWidth,
          veinWindiness,
          protect: state.reserved,
        },
        0.5 + passages.length * LANE_SPACING,
      );
      for (const shape of laid.roomShapes) {
        reserveRoomShape(state, shape);
      }
      for (const { position } of laid.roomExits) {
        openReserved(state, position.x, position.y);
      }
      // the new rooms and their exits follow on from the ones there are
      const firstId = rooms.length;
      const firstExit = roomExits.length;
      for (const room of laid.rooms) {
        rooms.push({
          ...room,
          id: room.id + firstId,
          exits: room.exits.map((exit) => exit + firstExit),
        });
      }
      for (const exit of laid.roomExits) {
        roomExits.push({
          ...exit,
          rooms: exit.rooms.map((id) => id + firstId),
        });
      }
      passages.push(...laid.passages);
      roomShapes.push(...laid.roomShapes);
      return { passages, rooms, roomExits, roomShapes };
    },
  );
}
