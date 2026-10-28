import type { MapStep } from '../pipeline/map-step';
import { step } from '../pipeline/step';
import { assertDigArea } from './assert-dig-area';
import { assertRingOptions } from './assert-ring-options';
import type { DigRingsOptions } from './dig-rings-options';
import { digInAreas } from './dig-in-areas';
import { layRings } from './lay-rings';
import type { MinePassage } from './mine-passage';

/**
 * A step that digs concentric rings around the middle of its area, evenly
 * spaced, the outermost one near the edge, each wobbling so that it is not a
 * perfect oval. Between every ring and the next, at least one spoke runs at a
 * random angle, which makes the mine one piece. The rings are closed in by a
 * ring of wall inside their area. Nothing is dug through a reserved tile, so
 * rings dug over reserved ground may come out in pieces.
 *
 * It uses `passages`, the tunnels of the steps before it, and adds `passages`
 * again with its own appended, each shifted to the coordinates of the map. The
 * map has to start as wall, which `pipeline` checks before the first attempt.
 * Throws a `RangeError` at once for a bad option.
 */
export function digRings(
  options: DigRingsOptions = {},
): MapStep<Partial<{ passages: MinePassage[] }>, { passages: MinePassage[] }> {
  const {
    density = 0.3,
    rings,
    ringShape = 'oval',
    ringWidth = { min: 2, max: 3 },
    ringWobble = 0.5,
    spokes = { min: 1, max: 3 },
    veinWidth = { min: 1, max: 2 },
    veinWindiness = 0.5,
    area = {},
    count = { min: 1, max: 1 },
  } = options;
  assertRingOptions(options);

  return step<
    Partial<{ passages: MinePassage[] }>,
    { passages: MinePassage[] }
  >(
    'digRings',
    {
      adds: ['passages'],
      validate: (state) => {
        assertDigArea('digRings', state, area, count);
      },
    },
    (state, { random }) => ({
      passages: digInAreas(
        state,
        random,
        area,
        count,
        (scratch, noise, lane) => ({
          passages: layRings(scratch.grid, random, noise, {
            density,
            rings,
            ringShape,
            ringWidth,
            ringWobble,
            spokes,
            veinWidth,
            veinWindiness,
            lane,
            protect: scratch.reserved,
          }),
        }),
      ).passages,
    }),
  );
}
