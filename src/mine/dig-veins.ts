import type { MapStep } from '../pipeline/map-step';
import { step } from '../pipeline/step';
import { assertDigArea } from './assert-dig-area';
import { assertVeinOptions } from './assert-vein-options';
import type { DigVeinsOptions } from './dig-veins-options';
import { digInAreas } from './dig-in-areas';
import { layVeins } from './lay-veins';
import type { MinePassage } from './mine-passage';

/**
 * A step that digs a web of veins: junctions are spread over the area, and the
 * shortest set of veins that joins them all is dug, which makes the mine one
 * piece. Then extra veins between neighboring junctions are dug, shortest
 * first, until the `density` is reached or there are none left, which turns the
 * tree into a web with loops. The mine is closed in by a ring of wall inside
 * its area. Veins are dug out of wall and never through a reserved tile, so a
 * mine dug over reserved ground may come out in pieces.
 *
 * It uses `passages`, the tunnels of the steps before it, and adds `passages`
 * again with its own appended, each shifted to the coordinates of the map. The
 * map has to start as wall, which `pipeline` checks before the first attempt.
 * Throws a `RangeError` at once for a bad option.
 */
export function digVeins(
  options: DigVeinsOptions = {},
): MapStep<Partial<{ passages: MinePassage[] }>, { passages: MinePassage[] }> {
  const {
    density = 0.15,
    veinWidth = { min: 1, max: 2 },
    veinWindiness = 0.5,
    veinSpacing = 16,
    area = {},
    count = { min: 1, max: 1 },
  } = options;
  assertVeinOptions(options);

  return step<
    Partial<{ passages: MinePassage[] }>,
    { passages: MinePassage[] }
  >(
    'digVeins',
    {
      adds: ['passages'],
      validate: (state) => {
        assertDigArea('digVeins', state, area, count);
      },
    },
    (state, { random }) => ({
      passages: digInAreas(
        state,
        random,
        area,
        count,
        (scratch, noise, lane) => ({
          passages: layVeins(scratch.grid, random, noise, {
            density,
            veinWidth,
            veinWindiness,
            veinSpacing,
            lane,
            protect: scratch.reserved,
          }),
        }),
      ).passages,
    }),
  );
}
