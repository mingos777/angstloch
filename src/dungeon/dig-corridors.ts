import { assertWallBase } from '../pipeline/assert-wall-base';
import type { MapStep } from '../pipeline/map-step';
import { step } from '../pipeline/step';
import { assertDigCorridorsOptions } from './assert-dig-corridors-options';
import type { DigCorridorsOptions } from './dig-corridors-options';
import { joinRooms } from './join-rooms';
import type { JoinedRooms } from './join-rooms';
import type { PlacedRooms } from './placed-rooms';
import { resolveCorridorSettings } from './resolve-corridor-settings';

/**
 * A step that joins the rooms of a dungeon with corridors, the rooms of
 * `placeScatteredRooms` or `placePartitionedRooms`. Only rooms that have no exits yet are
 * joined. Exits come from each room's shape in `roomShapes`, at its potential
 * exits that are still `Openable`; two ordinary rooms that share a wall get a
 * door in it instead of a corridor. Corridors keep off every tile that is not
 * free, so they route round what earlier steps built. Every fixed exit of a
 * template gets a corridor, then rooms get the exits they draw from
 * `exitsPerRoom`, loops and dead ends.
 *
 * An ordinary room that cannot be joined is dropped, with its twins: its
 * tiles go back to the base and its reservation is cleared. A templated room
 * that cannot be joined is routed again, up to 3 times in all, and then fails the
 * attempt with a `TemplatePlacementError`, which `pipeline` retries with new
 * rooms.
 *
 * Every exit goes through `openReserved`. It uses `rooms`, `roomShapes` and
 * `roomExits` from the steps before it, if any, and adds all three again, with
 * the dropped rooms left out and the rest renumbered. It needs no rooms: with
 * none to join, it joins the pieces of floor that other steps dug. The halls of
 * `digPillarHalls` and the caverns of the cave steps are rooms by their kind,
 * but are joined as such pieces, and never dropped. The map has to start as
 * wall, which `pipeline` checks before the first attempt. Throws a
 * `RangeError` at once for a bad option.
 */
export function digCorridors(
  options: DigCorridorsOptions = {},
): MapStep<Partial<PlacedRooms> & Partial<JoinedRooms>, JoinedRooms> {
  assertDigCorridorsOptions(options);
  const settings = resolveCorridorSettings(options);
  return step<Partial<PlacedRooms> & Partial<JoinedRooms>, JoinedRooms>(
    'digCorridors',
    {
      adds: ['rooms', 'roomShapes', 'roomExits'],
      validate: (state) => {
        assertWallBase('digCorridors', state);
      },
    },
    (state, { random }) => joinRooms(state, random, settings),
  );
}
