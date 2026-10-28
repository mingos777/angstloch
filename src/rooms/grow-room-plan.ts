import { DIRECTIONS } from '../core/directions';
import { pickRandom } from '../core/pick-random';
import type { Point } from '../core/point';
import type { Random } from '../core/random';
import { randomInt } from '../core/random-int';
import { createCenterRoom } from './create-center-room';
import { pickDirection } from './pick-direction';
import { pickRoomSize } from './pick-room-size';
import type { Room } from './room';
import { roomBeyond } from './room-beyond';
import { EDGE_CLEARANCE } from './room-plan';
import type { RoomPlacer } from './room-plan';
import { roomWithTwins } from './room-with-twins';
import { roomsConflict } from './rooms-conflict';

/** Failed tries in a row after which the map counts as full. */
const MAX_FAILURES = 300;

/** Random spots tried for the first room when the middle is taken. */
const SEED_TRIES = 100;

/** Failed tries in a row from one room after which it counts as crowded, and is picked only when every room is. */
const CROWDED_AFTER = 20;

type Box = Pick<Room, 'x' | 'y' | 'width' | 'height'>;

/** A room that new rooms are built off: its box, walls included, and how often in a row that failed. */
interface Parent {
  box: Box;
  failures: number;
}

/** Picks the first tile of a room, in steps of 2 from the first odd tile on the lattice. */
function pickOrigin(random: Random, step: number, max: number): number {
  return (
    EDGE_CLEARANCE +
    step * randomInt(random, 0, Math.floor((max - EDGE_CLEARANCE) / step))
  );
}

/** The box of an ordinary room with its wall ring. */
function boxOf(room: Room): Box {
  return {
    x: room.x - 1,
    y: room.y - 1,
    width: room.width + 2,
    height: room.height + 2,
  };
}

/**
 * Makes a placer that grows rooms from seeds: each new room goes beyond a wall
 * of a room there is, at one of `gaps` from it (0 shares the wall), facing it
 * so a straight corridor can join the two. The seeds are the boxes it is
 * given, or a room in the middle when there are none, which moves to the
 * nearest spot that fits when the middle is taken and the layout is not
 * symmetric. A room is picked among those that are not crowded, and the wall
 * by `share`, the share of the horizontal directions. Growing stops at the
 * room count and the fill, or when 300 tries in a row fail.
 */
export function growRoomPlan(
  gaps: readonly number[],
  share: number,
): RoomPlacer {
  return (random, plan, seeds) => {
    const { width, height, step, spacing, roomCount, fill } = plan;
    const rooms: Room[] = [];
    const parents: Parent[] = seeds.map((box) => ({ box, failures: 0 }));
    let covered = 0;
    const add = (room: Room): void => {
      rooms.push({ ...room, id: rooms.length });
      parents.push({ box: boxOf(room), failures: 0 });
      covered += room.width * room.height;
    };

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

    /** The room moved to the spot nearest where it is that fits, of some random ones, or `undefined` if none does. */
    const nearestFit = (room: Room): Room | undefined => {
      let best: Room | undefined;
      let bestDistance = Infinity;
      for (let i = 0; i < SEED_TRIES; ++i) {
        const moved = {
          ...room,
          x: pickOrigin(random, step, width - EDGE_CLEARANCE - room.width),
          y: pickOrigin(random, step, height - EDGE_CLEARANCE - room.height),
        };
        const distance = (moved.x - room.x) ** 2 + (moved.y - room.y) ** 2;
        if (distance < bestDistance && fitsTogether([moved])) {
          best = moved;
          bestDistance = distance;
        }
      }
      return best;
    };

    if (seeds.length === 0) {
      // a symmetric layout grows from a room that is its own mirror image, so
      // only a plain one may move off the middle when something is in the way
      const center = createCenterRoom(random, plan);
      const seed =
        center && !fitsTogether([center])
          ? plan.transforms.length === 0
            ? nearestFit(center)
            : undefined
          : center;
      if (!seed) {
        return rooms;
      }
      add(seed);
    }

    /** Tries to build a room off the parent, and returns whether it fit. */
    const grow = ({ box }: Parent): boolean => {
      const mirrored =
        plan.transforms.length > 0 && plan.symmetryChance > random();
      const direction = pickDirection(random, share);
      const heading = DIRECTIONS[direction] as Point;
      const gap = pickRandom(random, gaps);
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

      // a tile of the parent's wall, off its corners, and on the lattice odd
      const vertical = heading.y !== 0;
      const first = (vertical ? box.x : box.y) + 1;
      const last = (vertical ? box.x + box.width : box.y + box.height) - 2;
      const along =
        first + step * randomInt(random, 0, Math.floor((last - first) / step));
      const across =
        heading.x < 0
          ? box.x
          : heading.x > 0
            ? box.x + box.width - 1
            : heading.y < 0
              ? box.y
              : box.y + box.height - 1;
      // the new room's wall is the parent's for a gap of 0, else beyond the corridor
      const distance = gap === 0 ? 0 : gap + 1;
      const wall = vertical
        ? { x: along, y: across + heading.y * distance }
        : { x: across + heading.x * distance, y: along };
      const room = roomBeyond(
        random,
        wall,
        direction,
        roomWidth,
        roomHeight,
        step,
      );
      const group = mirrored ? roomWithTwins(room, plan.transforms) : [room];
      if (!fitsTogether(group)) {
        return false;
      }
      group.forEach(add);
      return true;
    };

    let failures = 0;
    while (
      rooms.length < roomCount.max &&
      (rooms.length < roomCount.min || covered / (width * height) < fill) &&
      failures < MAX_FAILURES
    ) {
      // crowded rooms get another chance once every room is crowded
      const open = parents.filter((parent) => parent.failures < CROWDED_AFTER);
      const parent = pickRandom(random, open.length > 0 ? open : parents);
      if (grow(parent)) {
        parent.failures = 0;
        failures = 0;
      } else {
        ++parent.failures;
        ++failures;
      }
    }
    return rooms;
  };
}
