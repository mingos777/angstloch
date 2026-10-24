import { EDGE_CLEARANCE } from './room-plan';
import type { RoomPlacer } from './room-plan';
import { pickRoomSize } from './pick-room-size';
import type { Random } from './random';
import { randomInt } from './random-int';
import type { Room } from './room';
import { roomsConflict } from './rooms-conflict';

/** Failed placements in a row after which the map counts as full. */
const MAX_FAILURES = 100;

/** Candidates compared at full spacing uniformity. */
const MAX_CANDIDATES = 10;

/** Picks the first tile of a room, in steps of 2 from the first odd tile on the lattice. */
function pickOrigin(random: Random, step: number, max: number): number {
  const first = EDGE_CLEARANCE;
  return first + step * randomInt(random, 0, Math.floor((max - first) / step));
}

function distanceToNearest(room: Room, others: Room[]): number {
  let nearest = Infinity;
  for (const other of others) {
    nearest = Math.min(
      nearest,
      (room.x + room.width / 2 - other.x - other.width / 2) ** 2 +
        (room.y + room.height / 2 - other.y - other.height / 2) ** 2,
    );
  }
  return nearest;
}

/**
 * Scatters rooms over the map by rejection sampling: random rooms are tried
 * until the target is met, the maximum room count is reached or the map is full.
 * With spacing uniformity, several candidates are tried at once and the one
 * farthest from the existing rooms wins.
 */
export const scatterRooms: RoomPlacer = (random, plan) => {
  const { width, height, step, spacing, roomCount, fill } = plan;
  const candidates =
    1 + Math.round(plan.spacingUniformity * (MAX_CANDIDATES - 1));
  const rooms: Room[] = [];

  let covered = 0;
  let failures = 0;
  while (
    rooms.length < roomCount.max &&
    (rooms.length < roomCount.min || covered / (width * height) < fill) &&
    failures < MAX_FAILURES
  ) {
    const fitting: Room[] = [];
    for (let i = 0; i < candidates; ++i) {
      const roomWidth = pickRoomSize(
        random,
        plan.widths,
        step,
        plan.sizeUniformity,
      );
      const roomHeight = pickRoomSize(
        random,
        plan.heights,
        step,
        plan.sizeUniformity,
      );
      const candidate = {
        id: rooms.length,
        x: pickOrigin(random, step, width - EDGE_CLEARANCE - roomWidth),
        y: pickOrigin(random, step, height - EDGE_CLEARANCE - roomHeight),
        width: roomWidth,
        height: roomHeight,
        exits: [],
        exitCount: 0,
        doorCount: 0,
      };
      if (!rooms.some((room) => roomsConflict(room, candidate, spacing))) {
        fitting.push(candidate);
      }
    }
    const best = fitting
      .map((room) => ({ room, distance: distanceToNearest(room, rooms) }))
      .sort((a, b) => b.distance - a.distance)[0];
    if (best) {
      rooms.push(best.room);
      covered += best.room.width * best.room.height;
      failures = 0;
    } else {
      ++failures;
    }
  }
  return rooms;
};
