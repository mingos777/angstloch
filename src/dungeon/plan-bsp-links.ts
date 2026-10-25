import type { Random } from '../core/random';
import { shuffle } from '../core/shuffle';
import { distanceBetween } from './distance-between';
import type { RoomLink } from './room-link';
import type { Room } from '../rooms/room';

/** The center of a room along an axis. */
function centerOf(room: Room, axis: 'x' | 'y'): number {
  return axis === 'x' ? room.x + room.width / 2 : room.y + room.height / 2;
}

/** How far the centers of the rooms are spread along an axis. */
function spreadOf(rooms: readonly Room[], axis: 'x' | 'y'): number {
  const centers = rooms.map((room) => centerOf(room, axis));
  return Math.max(...centers) - Math.min(...centers);
}

/**
 * Plans how to join rooms the way a BSP dungeon does. The rooms are cut in two,
 * and each half is cut again, until single rooms are left. A cut runs across
 * the axis where the centers of the rooms are more spread out, which is a
 * vertical cut on a tie, and it splits the rooms in half by their order along
 * that axis. Every cut needs one corridor between a room on each side.
 *
 * Returns one group of candidate links per cut, so one fewer than there are
 * rooms. A group holds every pair of a room from each side of the cut, closest
 * pair first, with the room of the first half as `a`. With a `random` source
 * the pairs are in a random order instead, so the first is a random room from
 * each side. Groups come smallest first: the cuts inside each half come before
 * the cut that makes the halves, so small clusters are joined before the
 * clusters are.
 */
export function planBspLinks(
  rooms: readonly Room[],
  random?: Random,
): RoomLink[][] {
  if (rooms.length < 2) {
    return [];
  }
  const axis = spreadOf(rooms, 'x') >= spreadOf(rooms, 'y') ? 'x' : 'y';
  const other = axis === 'x' ? 'y' : 'x';
  const ordered = [...rooms].sort(
    (p, q) =>
      centerOf(p, axis) - centerOf(q, axis) ||
      centerOf(p, other) - centerOf(q, other) ||
      p.id - q.id,
  );
  const half = Math.floor(ordered.length / 2);
  const first = ordered.slice(0, half);
  const second = ordered.slice(half);

  const pairs = first.flatMap((a) =>
    second.map((b) => ({ a, b, distance: distanceBetween(a, b) })),
  );
  const cut = random
    ? shuffle(random, pairs)
    : pairs.sort((p, q) => p.distance - q.distance);
  return [...planBspLinks(first, random), ...planBspLinks(second, random), cut];
}
