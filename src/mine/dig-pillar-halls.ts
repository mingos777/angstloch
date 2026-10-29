import type { Point } from '../core/point';
import { Tile } from '../core/tile';
import type { MapStep } from '../pipeline/map-step';
import { step } from '../pipeline/step';
import { addFeatureRoom } from '../rooms/add-feature-room';
import type { FeatureRooms } from '../rooms/feature-rooms';
import { assertDigArea } from './assert-dig-area';
import { assertPillarOptions } from './assert-pillar-options';
import type { DigPillarHallsOptions } from './dig-pillar-halls-options';
import { digInAreas } from './dig-in-areas';
import { layPillars } from './lay-pillars';

/**
 * A step that digs the halls of a room-and-pillar mine: a few large halls
 * placed apart from one another, with islands of wall left standing in them as
 * pillars. The halls are closed in by a ring of wall inside their area. No hall
 * covers a reserved tile. The halls are left apart; `digVeins` or
 * `digCorridors` joins them.
 *
 * Every hall is a room of kind `'pillarHall'`, its box the rectangle it was
 * dug in, whose corners may be wall, as its edges are ragged, and its shape
 * its floor, which blocks nothing and
 * reserves nothing. The halls of one area are a `'pillarHalls'` group. It uses
 * `rooms`, `roomShapes` and `roomGroups` from the steps before it, and adds
 * them again with its own appended, in the coordinates of the map. The map has
 * to start as wall, which `pipeline` checks before the first attempt. Throws a
 * `RangeError` at once for a bad option.
 */
export function digPillarHalls(
  options: DigPillarHallsOptions = {},
): MapStep<Partial<FeatureRooms>, FeatureRooms> {
  const {
    density = 0.35,
    halls = { min: 2, max: 4 },
    hallSize,
    hallRagged = 0.5,
    pillarSize = { min: 2, max: 5 },
    pillarSpacing = { min: 2, max: 4 },
    pillarRagged = 0.5,
    pillarJitter = 0.5,
    area = {},
    count = { min: 1, max: 1 },
  } = options;
  assertPillarOptions(options);

  return step<Partial<FeatureRooms>, FeatureRooms>(
    'digPillarHalls',
    {
      adds: ['rooms', 'roomShapes', 'roomGroups'],
      validate: (state) => {
        assertDigArea('digPillarHalls', state, area, count);
      },
    },
    (state, { random }) => {
      const { areas } = digInAreas(state, random, area, count, (scratch) => {
        const laid = layPillars(scratch.grid, random, {
          density,
          halls,
          hallSize,
          hallRagged,
          pillarSize,
          pillarSpacing,
          pillarRagged,
          pillarJitter,
          protect: scratch.reserved,
        });
        return {
          passages: laid.passages,
          halls: laid.halls.map((hall) => {
            const tiles: Point[] = [];
            for (let y = hall.y; y < hall.y + hall.height; ++y) {
              for (let x = hall.x; x < hall.x + hall.width; ++x) {
                if (scratch.grid.get(x, y) === Tile.Floor) {
                  tiles.push({ x, y });
                }
              }
            }
            return { box: hall, tiles };
          }),
        };
      });
      const added: FeatureRooms = {
        rooms: [...(state.rooms ?? [])],
        roomShapes: [...(state.roomShapes ?? [])],
        roomGroups: [...(state.roomGroups ?? [])],
      };
      // an area with no room for a hall makes no group
      for (const { box, halls: dug } of areas.filter(
        ({ halls: found }) => found.length > 0,
      )) {
        const group = added.roomGroups.length;
        added.roomGroups.push({ kind: 'pillarHalls', area: box });
        for (const { box: hall, tiles } of dug) {
          addFeatureRoom(added, 'pillarHall', group, tiles, hall);
        }
      }
      return added;
    },
  );
}
