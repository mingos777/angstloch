import type { Room } from './room';
import type { Transform } from './templates/create-transforms';

/** The room and its distinct mirror images under the transforms. */
export function roomWithTwins(
  room: Room,
  transforms: readonly Transform[],
): Room[] {
  const group = [room];
  for (const transform of transforms) {
    const image = transform.room(room);
    if (
      !group.some(
        (other) =>
          other.x === image.x &&
          other.y === image.y &&
          other.width === image.width &&
          other.height === image.height,
      )
    ) {
      group.push(image);
    }
  }
  return group;
}
