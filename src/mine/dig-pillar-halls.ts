import type { Area } from '../core/area';
import type { MapStep } from '../pipeline/map-step';
import { step } from '../pipeline/step';
import { assertDigArea } from './assert-dig-area';
import { assertPillarOptions } from './assert-pillar-options';
import type { DigPillarHallsOptions } from './dig-pillar-halls-options';
import { digInAreas } from './dig-in-areas';
import { layPillars } from './lay-pillars';
import type { MinePassage } from './mine-passage';

/**
 * A step that digs a room-and-pillar mine: a few large halls placed apart from
 * one another, joined into one network of veins routed through the rock around
 * them, with islands of wall left standing in the halls as pillars. The halls
 * are closed in by a ring of wall inside their area. No hall covers a reserved
 * tile and no vein digs through one.
 *
 * It uses `passages` and `halls`, from the steps before it, and adds both
 * again with its own appended, shifted to the coordinates of the map. The map
 * has to start as wall, which `pipeline` checks before the first attempt.
 * Throws a `RangeError` at once for a bad option.
 */
export function digPillarHalls(
  options: DigPillarHallsOptions = {},
): MapStep<
  Partial<{ passages: MinePassage[]; halls: Area[] }>,
  { passages: MinePassage[]; halls: Area[] }
> {
  const {
    density = 0.35,
    halls = { min: 2, max: 4 },
    hallVeins = { min: 2, max: 4 },
    hallEntrances = 'facing',
    hallSize,
    hallRagged = 0.5,
    pillarSize = { min: 2, max: 5 },
    pillarSpacing = { min: 2, max: 4 },
    pillarRagged = 0.5,
    pillarJitter = 0.5,
    veinWidth = { min: 1, max: 2 },
    veinWindiness = 0.5,
    area = {},
    count = { min: 1, max: 1 },
  } = options;
  assertPillarOptions(options);

  return step<
    Partial<{ passages: MinePassage[]; halls: Area[] }>,
    { passages: MinePassage[]; halls: Area[] }
  >(
    'digPillarHalls',
    {
      adds: ['passages', 'halls'],
      validate: (state) => {
        assertDigArea('digPillarHalls', state, area, count);
      },
    },
    (state, { random }) =>
      digInAreas(state, random, area, count, (scratch, noise, lane) =>
        layPillars(scratch.grid, random, noise, {
          density,
          halls,
          hallVeins,
          hallEntrances,
          hallSize,
          hallRagged,
          pillarSize,
          pillarSpacing,
          pillarRagged,
          pillarJitter,
          veinWidth,
          veinWindiness,
          lane,
          protect: scratch.reserved,
        }),
      ),
  );
}
