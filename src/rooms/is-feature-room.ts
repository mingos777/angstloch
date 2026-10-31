import type { Room } from './room';
import type { RoomKind } from './room-kind';

const FEATURE_KINDS: readonly RoomKind[] = [
  'pillarHall',
  'cavern',
  'sewerChamber',
  'sewerTunnel',
  'cistern',
];

/**
 * Whether a room is a feature, a hall, a cavern or a part of a sewer: one that
 * is joined anywhere on its boundary like a stand-in, is never dropped and
 * whose shape blocks nothing. A feature reserves none of its walls as a way
 * in, though a sewer reserves the walls beside its water `Solid`. The steps
 * key their treatment of a room on this, never on its being in `rooms`.
 */
export function isFeatureRoom(room: Pick<Room, 'kind'>): boolean {
  return FEATURE_KINDS.includes(room.kind);
}
