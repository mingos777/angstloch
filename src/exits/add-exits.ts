import { assertFraction } from '../core/assert-fraction';
import { assertLayoutSymmetry } from '../core/assert-layout-symmetry';
import { assertRange } from '../core/assert-range';
import { assertTile } from '../core/assert-tile';
import type { Point } from '../core/point';
import { randomInt } from '../core/random-int';
import { Tile } from '../core/tile';
import { openReserved } from '../pipeline/open-reserved';
import type { MapStep } from '../pipeline/map-step';
import { stampTile } from '../pipeline/stamp-tile';
import { step } from '../pipeline/step';
import { createTransforms } from '../rooms/templates/create-transforms';
import type { AddExitsOptions } from './add-exits-options';
import { carveCaveExit } from './carve-cave-exit';

/** How many times in a row an exit may fail, when it is left out for lack of room or for being crowded, before the step stops trying. */
const EXIT_ATTEMPTS = 10;

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
 * Throws a `RangeError` at once for a bad option.
 */
export function addExits(
  options: AddExitsOptions = {},
): MapStep<Partial<{ exits: Point[] }>, { exits: Point[] }> {
  const {
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

  return step<Partial<{ exits: Point[] }>, { exits: Point[] }>(
    'addExits',
    { adds: ['exits'] },
    (state, { random }) => {
      const { grid, reserved } = state;
      const exits = [...(state.exits ?? [])];
      const wanted = randomInt(random, count.min, count.max);
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
