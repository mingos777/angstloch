import type { MapStep } from '../pipeline/map-step';
import { step } from '../pipeline/step';
import { assertDigArea } from './assert-dig-area';
import { assertFishboneOptions } from './assert-fishbone-options';
import type { DigFishboneOptions } from './dig-fishbone-options';
import { digInAreas } from './dig-in-areas';
import { layFishbone } from './lay-fishbone';
import type { MinePassage } from './mine-passage';

/**
 * A step that digs a fishbone mine: the main shaft first, through a point near
 * the middle of the area, and then side tunnels, the adits, which branch off
 * the existing ones until the `density` is reached. The mine is one connected
 * piece, closed in by a ring of wall inside its area. Tunnels are dug out of
 * wall and never through a reserved tile, so a mine dug over reserved ground
 * may come out in pieces.
 *
 * It uses `passages`, the tunnels of the steps before it, and adds `passages`
 * again with its own appended, each shifted to the coordinates of the map. The
 * map has to start as wall, which `pipeline` checks before the first attempt.
 * Throws a `RangeError` at once for a bad option.
 */
export function digFishbone(
  options: DigFishboneOptions = {},
): MapStep<Partial<{ passages: MinePassage[] }>, { passages: MinePassage[] }> {
  const {
    density = 0.15,
    shaftWidth = { min: 2, max: 3 },
    shaftWindiness = 0.1,
    angle = 'random',
    aditWidth = { min: 1, max: 2 },
    aditWindiness = 0.4,
    aditLength = { min: 15, max: 50 },
    branchAngle = { min: 45, max: 90 },
    loops = 0,
    area = {},
    count = { min: 1, max: 1 },
  } = options;
  assertFishboneOptions(options);

  return step<
    Partial<{ passages: MinePassage[] }>,
    { passages: MinePassage[] }
  >(
    'digFishbone',
    {
      adds: ['passages'],
      validate: (state) => {
        assertDigArea('digFishbone', state, area, count);
      },
    },
    (state, { random }) => ({
      passages: digInAreas(
        state,
        random,
        area,
        count,
        (scratch, noise, lane) => ({
          passages: layFishbone(scratch.grid, random, noise, {
            density,
            shaftWidth,
            shaftWindiness,
            angle: angle === 'random' ? random() * 180 : angle,
            aditWidth,
            aditWindiness,
            aditLength,
            branchAngle,
            loops,
            lane,
            protect: scratch.reserved,
          }),
        }),
      ).passages,
    }),
  );
}
