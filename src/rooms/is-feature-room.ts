import type { Room } from './room';

/**
 * Whether a room is a feature, a hall or a cavern: one that reserves nothing,
 * is joined anywhere on its boundary like a stand-in, is never dropped and
 * whose shape blocks nothing. The steps key their treatment of a room on this,
 * never on its being in `rooms`.
 */
export function isFeatureRoom(room: Pick<Room, 'kind'>): boolean {
  return room.kind === 'pillarHall' || room.kind === 'cavern';
}
