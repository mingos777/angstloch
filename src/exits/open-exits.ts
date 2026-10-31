import { assertFraction } from '../core/assert-fraction';
import { assertLayoutSymmetry } from '../core/assert-layout-symmetry';
import { assertRange } from '../core/assert-range';
import { assertTile } from '../core/assert-tile';
import type { Point } from '../core/point';
import { randomInt } from '../core/random-int';
import { Tile } from '../core/tile';
import { openReserved } from '../pipeline/open-reserved';
import { Reserve } from '../pipeline/reserve';
import { shuffle } from '../core/shuffle';
import type { RoomGroup } from '../rooms/room-group';
import type { MapStep } from '../pipeline/map-step';
import { stampTile } from '../pipeline/stamp-tile';
import { step } from '../pipeline/step';
import { createTransforms } from '../rooms/templates/create-transforms';
import type { OpenExitsOptions } from './open-exits-options';
import { carveCaveExit } from './carve-cave-exit';

/** How many times in a row an exit may fail, when it is left out for lack of room or for being crowded, before the step stops trying. */
const EXIT_ATTEMPTS = 10;

/** What `openExits` uses: the exits so far, and the groups whose sewers have outfalls. */
interface ExitsIn {
  exits: Point[];
  roomGroups: RoomGroup[];
}

const PLACES = ['border', 'outfalls'] as const;

/**
 * A step that carves exits into the border of the map: each is a door on the
 * border and a straight tunnel to the nearest floor, found by going straight
 * in, and never through a reserved tile. On each side the exits with the
 * shortest tunnels are the candidates. A door is never next to another door,
 * and the doors of an `exits` extra that is already in the state count. With a
 * `symmetry`, an exit gets twins with the chance `symmetryChance`. The step
 * stops when it has made `count` exits or when it fails ten times in a row,
 * for lack of floor to reach or of room. Each door is recorded with
 * `openReserved`. It adds `exits`: those of the state, if any, and the new ones.
 *
 * With `at: 'outfalls'` it opens the outfalls of the sewers in `roomGroups`
 * instead (see `digSewers`): `count` of those still reserved `Openable`, at
 * random, or all of them when there are fewer. Each becomes `tile`, with no
 * tunnel, since the sewer's walkway reaches it. An outfall left unopened stays
 * wall. Throws a `RangeError` at once for a bad option.
 */
export function openExits(
  options: OpenExitsOptions = {},
): MapStep<Partial<ExitsIn>, { exits: Point[] }> {
  const {
    at = 'border',
    count = { min: 0, max: 0 },
    lattice = false,
    symmetry = 'none',
    symmetryChance = 1,
    tile = Tile.Door,
  } = options;
  assertRange('count', count, 0);
  assertLayoutSymmetry('symmetry', symmetry);
  assertFraction('symmetryChance', symmetryChance);
  assertTile('tile', tile);
  if (!PLACES.includes(at)) {
    throw new RangeError(`at must be one of ${PLACES.join(', ')}, got ${at}`);
  }

  return step<Partial<ExitsIn>, { exits: Point[] }>(
    'openExits',
    { adds: ['exits'] },
    (state, { random }) => {
      const { grid, reserved } = state;
      const exits = [...(state.exits ?? [])];
      const wanted = randomInt(random, count.min, count.max);
      if (at === 'outfalls') {
        const outfalls = (state.roomGroups ?? [])
          .flatMap((group) => (group.kind === 'sewer' ? group.outfalls : []))
          .map(({ position }) => position)
          .filter(
            ({ x, y }) => reserved[y * grid.width + x] === Reserve.Openable,
          );
        for (const { x, y } of shuffle(random, outfalls).slice(0, wanted)) {
          stampTile(state, x, y, tile);
          openReserved(state, x, y);
          exits.push({ x, y });
        }
        return { exits };
      }
      const images = createTransforms(
        symmetry,
        grid.width,
        grid.height,
        lattice,
      );
      let added = 0;
      for (let misses = 0; added < wanted && misses < EXIT_ATTEMPTS;) {
        const made = carveCaveExit(
          grid,
          random,
          exits,
          { images, chance: symmetryChance, room: wanted - added },
          {
            lattice,
            reserved,
            tile,
            stamp: (x, y, stamped) => {
              stampTile(state, x, y, stamped);
            },
          },
        );
        if (made.length === 0) {
          ++misses;
        }
        for (const { x, y } of made) {
          openReserved(state, x, y);
        }
        exits.push(...made);
        added += made.length;
      }
      return { exits };
    },
  );
}
