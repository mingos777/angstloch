import { createCenterRoom } from './create-center-room';
import { EDGE_CLEARANCE } from './room-plan';
import type { RoomPlacer } from './room-plan';
import { pickRoomSize } from './pick-room-size';
import type { Random } from '../core/random';
import { randomInt } from '../core/random-int';
import type { Room } from './room';
import { roomWithTwins } from './room-with-twins';
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
export const scatterRoomPlan: RoomPlacer = (random, plan) => {
  const { width, height, step, spacing, roomCount, fill } = plan;
  const candidates =
    1 + Math.round(plan.spacingUniformity * (MAX_CANDIDATES - 1));
  const rooms: Room[] = [];

  let covered = 0;
  const add = (room: Room): void => {
    rooms.push({ ...room, id: rooms.length });
    covered += room.width * room.height;
  };
  if (plan.transforms.length > 0) {
    // a symmetric layout starts with a room that is its own mirror image
    const center = createCenterRoom(random, plan);
    if (!center) {
      return rooms;
    }
    if (!plan.isBlocked?.(center)) {
      add(center);
    }
  }

  const fitsTogether = (group: Room[]): boolean =>
    rooms.length + group.length <= roomCount.max &&
    group.every(
      (room, i) =>
        room.x >= EDGE_CLEARANCE &&
        room.y >= EDGE_CLEARANCE &&
        room.x + room.width <= width - EDGE_CLEARANCE &&
        room.y + room.height <= height - EDGE_CLEARANCE &&
        !plan.isBlocked?.(room) &&
        !rooms.some((other) => roomsConflict(other, room, spacing)) &&
        !group
          .slice(i + 1)
          .some((other) => roomsConflict(other, room, spacing)),
    );

  let failures = 0;
  while (
    rooms.length < roomCount.max &&
    (rooms.length < roomCount.min || covered / (width * height) < fill) &&
    failures < MAX_FAILURES
  ) {
    const mirrored =
      plan.transforms.length > 0 && plan.symmetryChance > random();
    const fitting: Room[][] = [];
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
      const candidate: Room = {
        id: rooms.length,
        kind: 'room',
        x: pickOrigin(random, step, width - EDGE_CLEARANCE - roomWidth),
        y: pickOrigin(random, step, height - EDGE_CLEARANCE - roomHeight),
        width: roomWidth,
        height: roomHeight,
        exits: [],
        exitCount: 0,
        doorCount: 0,
      };
      const group = mirrored
        ? roomWithTwins(candidate, plan.transforms)
        : [candidate];
      if (fitsTogether(group)) {
        fitting.push(group);
      }
    }
    const best = fitting
      .map((group) => ({
        group,
        distance: distanceToNearest(group[0] as Room, rooms),
      }))
      .sort((a, b) => b.distance - a.distance)[0];
    if (best) {
      best.group.forEach(add);
      failures = 0;
    } else {
      ++failures;
    }
  }
  return rooms;
};
