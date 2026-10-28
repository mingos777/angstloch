import type { Area } from '../core/area';
import type { MapStep } from '../pipeline/map-step';
import { step } from '../pipeline/step';
import { assertDigArea } from './assert-dig-area';
import { assertPillarOptions } from './assert-pillar-options';
import type { DigPillarHallsOptions } from './dig-pillar-halls-options';
import { digInAreas } from './dig-in-areas';
import { layPillars } from './lay-pillars';

/**
 * A step that digs the halls of a room-and-pillar mine: a few large halls
 * placed apart from one another, with islands of wall left standing in them as
 * pillars. The halls are closed in by a ring of wall inside their area. No hall
 * covers a reserved tile. The halls are left apart; `digHallVeins` joins them
 * with veins routed through the rock around them, and `digVeins` or
 * `digCorridors` can join them too.
 *
 * It uses `halls`, from the steps before it, and adds `halls` again with its
 * own appended, shifted to the coordinates of the map. The map has to start as
 * wall, which `pipeline` checks before the first attempt. Throws a
 * `RangeError` at once for a bad option.
 */
export function digPillarHalls(
  options: DigPillarHallsOptions = {},
): MapStep<Partial<{ halls: Area[] }>, { halls: Area[] }> {
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

  return step<Partial<{ halls: Area[] }>, { halls: Area[] }>(
    'digPillarHalls',
    {
      adds: ['halls'],
      validate: (state) => {
        assertDigArea('digPillarHalls', state, area, count);
      },
    },
    (state, { random }) => ({
      halls: digInAreas(state, random, area, count, (scratch) =>
        layPillars(scratch.grid, random, {
          density,
          halls,
          hallSize,
          hallRagged,
          pillarSize,
          pillarSpacing,
          pillarRagged,
          pillarJitter,
          protect: scratch.reserved,
        }),
      ).halls,
    }),
  );
}
