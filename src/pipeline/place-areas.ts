import type { Area } from '../core/area';
import { randomInt } from '../core/random-int';
import type { Random } from '../core/random';
import type { Range } from '../core/range';
import type { AreaSpec } from './area-spec';
import type { MapState } from './map-state';
import { pickAreaSize } from './pick-area-size';
import { placeArea } from './place-area';
import type { PlaceAreaSettings } from './place-area-settings';

/**
 * Picks the boxes a feature step builds in, one for each copy: `count` is drawn
 * from its range, and each box gets a size from `area` (the size of the map for
 * a missing range). A box as big as the map is the whole map, as it is. Any
 * other goes on a random spot where every tile of the box and of a margin of one
 * tile round it is free (see `isFree`), and which is clear of the boxes picked
 * before, so that copies never touch. On a `lattice` a box has odd sizes and
 * starts on even coordinates, so that a maze or lattice rooms line up with the
 * map's lattice. With `overlap`, a spot need only be clear of the other boxes,
 * so the box may cover anything. A window (`area.x`, `area.y`) limits the spots
 * to those where the anchor of the box falls in it; on a lattice the box may end
 * one tile off the window's edge. With `area.gravity`, the box then slides
 * toward a side, a corner or the middle, and stops where it would no longer be
 * clear (see `slide`), so copies pile up against each other. With `accepts`, a
 * box must also pass it: it is asked after the box is found clear, for every
 * spot drawn, for every step of a slide, and for a box as big as the map, so a
 * step can turn spots down by what they hold. A copy that finds no spot in 100
 * tries (or whose whole map is not accepted) throws an ordinary `Error`, which
 * `pipeline` answers with a new map. Check the options with `assertAreaSpec`
 * first.
 */
export function placeAreas(
  state: Pick<MapState, 'grid' | 'base' | 'prunable' | 'reserved'>,
  random: Random,
  area: AreaSpec,
  count: Range,
  settings: PlaceAreaSettings = {},
): Area[] {
  const { width, height } = state.grid;
  const lattice = settings.lattice ?? false;
  const copies = randomInt(random, count.min, count.max);
  const boxes: Area[] = [];
  for (let copy = 0; copy < copies; ++copy) {
    const size = {
      width: pickAreaSize(random, area.width, width, lattice),
      height: pickAreaSize(random, area.height, height, lattice),
    };
    const box = placeArea(state, random, size, area, boxes, settings);
    if (!box) {
      if (size.width >= width && size.height >= height) {
        throw new Error(
          `The whole ${String(width)} by ${String(height)} map, the only spot for an area as big as the map, is not accepted (copy ${String(copy + 1)} of ${String(copies)}). Make the area smaller than the map, so that it has other spots to try.`,
        );
      }
      throw new Error(
        `No free spot for an area of ${String(size.width)} by ${String(size.height)} tiles on a ${String(width)} by ${String(height)} map after 100 tries (copy ${String(copy + 1)} of ${String(copies)}). The rest of the map is too crowded: make the area smaller, ask for fewer copies, or run this step before the ones that fill the map.`,
      );
    }
    boxes.push(box);
  }
  return boxes;
}
